//META{"name":"screenShare"}*//
let screenShare = function() {}

const domain = ''
const wspath = '/ssws'
const staticpath = '/screenshare'
let pluginPath
if (process.platform != 'win32') {
   pluginPath = `${process.env.HOME}/Preferences/BetterDiscord/plugins/screenShare.plugin.js`
} else {
   pluginPath = `${process.env.APPDATA}\\BetterDiscord\\plugins\\screenShare.plugin.js`
}

let primus
let mediaStream
let webRtcPeer
let sharing = false
let reconnecting = true
let remoteHash
let localHash
let pendingUpdate = false
let i
let isShare = false
const { desktopCapturer } = require('electron')
const crypto = require('crypto')
const request = require('request')
const fs = require('fs')

screenShare.prototype.start = function() {
   let t = `${domain}${staticpath}/icon.png`
   let main = this
   fs.readFile(pluginPath, 'utf8', (err, localfile) => {
      localHash = crypto.createHash('sha256').update(localfile).digest('hex')
      $.when(
         $.getScript(`${domain}${staticpath}/primus.js`),
         $.getScript(`${domain}${staticpath}/kurento-utils.min.js`),
         $.getScript(`${domain}${staticpath}/adapter.js`)
      ).then(() => {
         main.ready()
      })
   })
}

screenShare.prototype.ready = function() {
   primus = Primus.connect(`${domain}${wspath}/?version=${localHash}`)
   $('.header-toolbar').prepend('<button id="screenshare" type="button" style="background-image:url(' + domain + staticpath + '/icon.png' + ');background-repeat:no-repeat"></button>')
   setInterval(() => {
      if (!$('#screenshare')) {
         $('.header-toolbar').prepend('<button id="screenshare" type="button" style="background-image:url(' + domain + staticpath + '/icon.png' + ');background-repeat:no-repeat"></button>')
      }
   }, 10000)
   let mainFunc = this
   $('#screenshare').click(() => {
      if (pendingUpdate) {
         let updateOrNot = confirm('Would you like to update now?\nCancel: start share screen\nOK: Update Now')
         if (updateOrNot) {
            window.location.reload()
         } else {
            primus.write({ type: 'button' })
         }
      } else {
         primus.write({ type: 'button' })
      }
   })
   primus.on('data', msg => {
      if (msg.type === 'ice') {
         webRtcPeer.addIceCandidate(msg.ice)
      }
      if (msg.type === 'shareAccepted') {
         webRtcPeer.processAnswer(msg.answer)
      }
      if (msg.type === 'viewAccepted') {
         webRtcPeer.processAnswer(msg.answer)
      }
      if (msg.type === 'stop') {
         mainFunc.stopScreen()
      }
      if (msg.type === 'startView') {
         mainFunc.startView()
      }
      if (msg.type === 'startShare') {
         mainFunc.startShare()
      }
      if (msg.type === 'update') {
         fs.writeFile(pluginPath, msg.file, (err, wrote) => {
            if (!err) {
               $('#screenshare').css({ 'background-image': 'url(' + domain + staticpath + '/iconUpdate.png)' })
               pendingUpdate = true
            }
         })
      }
   })
   primus.on('reconnect', () => {
      if (reconnecting) {
         mainFunc.stopScreen()
         reconnecting = false
      }
   })
   primus.on('reconnected', () => {
      reconnecting = true
   })
}

screenShare.prototype.startShare = function() {
   let main = this
   desktopCapturer.getSources({ types: ['screen'] }, (error, sources) => {
      if (error) throw error
      navigator.webkitGetUserMedia({
         audio: false,
         video: {
            mandatory: {
               chromeMediaSource: 'desktop',
               chromeMediaSourceId: sources[0].id,
               minWidth: 1280,
               maxWidth: 1280,
               minHeight: 720,
               maxHeight: 720
            }
         }
      }, handleStream, handleError)
   })

   function handleStream(stream) {
      mediaStream = stream
      var options = {
         videoStream: stream,
         onicecandidate: main.onIceCandidate
      }
      webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(err) {
         if (err) {
            console.log(err)
         }
         this.generateOffer((err, offer) => {
            if (err) {
               console.log(err)
            } else {
               var message = {
                  type: 'share',
                  offer: offer,
                  username: $('.username').text()
               }
               $('.message-text').last().append("<video id='ssvideo' autoplay controls muted style='width:100%;height:100%'src=" + URL.createObjectURL(stream) + ">")
               sharing = true
               isShare = true
               primus.write(message)
            }
         })
      })
   }

   function handleError(e) {
      console.log(e)
   }
}

screenShare.prototype.startView = function() {
   $('.message-text').last().append("<video id='ssvideo' autoplay controls muted style='width:100%;height:100%'>")
   let video = document.getElementById('ssvideo')
   let main = this
   let options = {
      onicecandidate: main.onIceCandidate,
      remoteVideo: video
   }

   webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
      if (error) console.log(err)

      this.generateOffer((err, offer) => {
         if (err) {
            console.log(err)
         } else {
            var message = {
               type: 'view',
               offer: offer,
               username: $('.username').text()
            }
            isShare = true
            primus.write(message)
         }
      })
   })
}

screenShare.prototype.onIceCandidate = function(candidate) {
   var message = {
      type: 'ice',
      ice: candidate
   }
   primus.write(message)
}

screenShare.prototype.onSwitch = function() {
   if (i === 1) {
      if (isShare === true) {
         $('.message-text').last().append("<video id='ssvideo' autoplay controls muted style='width:100%;height:100%'src=" + (webRtcPeer.remoteVideo.src || mediaStream) + ">")
      }
      i = 0
   } else {
      i = 1
   }
}

screenShare.prototype.stopScreen = function() {
   webRtcPeer.dispose()
   webRtcPeer = null
   isShare = false
   $('#ssvideo').remove()
   if (sharing) {
      sharing = false
      mediaStream.getVideoTracks()[0].stop()
   }
}

screenShare.prototype.getSettingsPanel = function() {
   return "<h3>Settings Panel</h3>"
}
screenShare.prototype.getName = function() {
   return "Screen Share"
}
screenShare.prototype.getDescription = function() {
   return "Shares your screen"
}
screenShare.prototype.getVersion = function() {
   return "0.4.0"
}
screenShare.prototype.getAuthor = function() {
   return "ConnorTheFox"
}

screenShare.prototype.load = function() {}