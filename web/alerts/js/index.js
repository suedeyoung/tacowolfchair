/*
 * Copyright (C) 2016-2018 phantombot.tv
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
$(function() {
    var webSocket = getWebSocket(),
        queryMap = getQueryMap(),
        isPlaying = false,
        queue = [];

    /*
     * @function Gets a new instance of the websocket.
     *
     * @return {ReconnectingWebSocket}
     */
    function getWebSocket() {
        let locationHost = window.location.host.substr(0, window.location.host.indexOf(':')), // Domain part of the URL.
            socketUri = ((getProtocol() == 'https://' ? 'wss://' : 'ws://') + locationHost + ':' + getPanelPort()), // URI of the socket.
            reconnectInterval = 5000; // How often in milliseconds we should try reconnecting.

        return new ReconnectingWebSocket(socketUri, null, {
            reconnectInterval: reconnectInterval
        });
    }

    /*
     * @function Parses the query params in the URL and puts them into a map.
     *
     * @return {Map}
     */
    function getQueryMap() {
        let queryString = window.location.search, // Query string that starts with ?
            queryParts = queryString.substr(1).split('&'), // Split at each &, which is a new query.
            queryMap = new Map(); // Create a new map for save our keys and values.

        for (let i = 0; i < queryParts.length; i++) {
            let key = queryParts[i].substr(0, queryParts[i].indexOf('=')),
                value = queryParts[i].substr(queryParts[i].indexOf('=') + 1, queryParts[i].length);

            if (key.length > 0 && value.length > 0) {
                queryMap.set(key, value);
            }
        }

        return queryMap;
    }

    /*
     * @function Checks if the query map has the option, if not, returns default.
     *
     * @param  {String} option
     * @param  {String} def
     * @return {String}
     */
    function getOptionSetting(option, def) {
        if (queryMap.has(option)) {
            return queryMap.get(option);
        } else {
            return def;
        }
    }

    /*
     * @function Sends a message to the socket
     *
     * @param {String} message
     */
    function sendToSocket(message) {
        try {
            webSocket.send(JSON.stringify(message));
        } catch (ex) {
            console.error('Failed to send a message to the socket: ' + ex.stack);
        }
    }

    /*
     * @function Handles the queue.
     */
    function handleQueue() {
        let event = queue[0];

        if (event !== undefined && isPlaying === false) {
            console.log('Processing event ' + JSON.stringify(event));

            isPlaying = true;
            if (event.alert_image !== undefined) {
                handleGifAlert(event);
            } else {
                handleAudioHook(event);
            }
            queue.splice(0, 1);
        }
    }

    /*
     * @function Checks for if the audio file exists since the socket doesn't pass the file type.
     *
     * @param  {String} name
     * @return {String}
     */
    function getAudioFile(name) {
        let defaultPath = '/config/audio-hooks/',
            fileName = '';

        $.ajax({
            async: false,
            url: defaultPath + name + '.mp3',
            success: function() {
                fileName = (defaultPath + name + '.mp3');
            },
            error: function() {
                $.ajax({
                    async: false,
                    url: defaultPath + name + '.aac',
                    success: function() {
                        fileName = (defaultPath + name + '.aac');
                    },
                    error: function() {
                        $.ajax({
                            async: false,
                            url: defaultPath + name + '.ogg',
                            success: function() {
                                fileName = (defaultPath + name + '.ogg');
                            }
                        });
                    }
                });
            }
        });

        return fileName;
    }

    /*
     * @function Handles audio hooks.
     *
     * @param {Object} json
     */
    function handleAudioHook(json) {
        // Make sure we can allow audio hooks.
        if (getOptionSetting('allow-audio-hooks', 'false') === 'true') {
            let audioFile = getAudioFile(json.audio_panel_hook),
                audio;

            // Create a new audio file.
            audio = new Audio(audioFile);
            // Set the volume.
            audio.volume = getOptionSetting('audio-hook-volume', '1');
            // Add an event handler.
            $(audio).on('ended', function() {
                audio.currentTime = 0;
                isPlaying = false;
            });
            // Play the audio.
            audio.play();
        }
    }

    /*
     * @function Handles GIF alerts.
     *
     * @param {Object} json
     */
    function handleGifAlert(json) {
        // Make sure we can allow alerts.
        if (getOptionSetting('allow-alerts', 'true') === 'true') {
            let defaultPath = '/config/gif-alerts/',
                gifData = json.alert_image,
                gifDuration = 3000,
                gifVolume = getOptionSetting('gif-default-volume', '0.8'),
                gifFile = '',
                gifCss = '',
                htmlObj,
                audio;

            // If a comma is found, that means there are custom settings.
            if (gifData.indexOf(',') !== -1) {
                let gifSettingParts = gifData.split(',');

                // Loop through each setting and set it if found.
                gifSettingParts.forEach(function(value, index) {
                    switch (index) {
                        case 0:
                            gifFile = value;
                            break;
                        case 1:
                            gifDuration = (parseInt(value) * 1000);
                            break;
                        case 2:
                            gifVolume = value;
                            break;
                        case 3:
                            gifCss = value;
                            break;
                    }
                });
            } else {
                gifFile = gifData;
            }

            // Check if the file is a gif, or video.
            if (gifFile.match(/\.(webm|mp4|ogg)$/) !== null) {
                htmlObj = $('<video/>', {
                    'src': defaultPath + gifFile,
                    'volume': gifVolume,
                    'autoplay': 'autoplay',
                    'style': gifCss
                });
            } else {
                htmlObj = $('<img/>', {
                    'src': defaultPath + gifFile,
                    'style': gifCss
                });
            }

            // Append a new the image.
            $('#alert').append(htmlObj).fadeIn(1e2, function() {
                audio = new Audio(defaultPath + gifFile.substr(0, gifFile.indexOf('.')) + '.mp3');

                // Set the volume.
                audio.volume = gifVolume;
                // Play the sound.
                audio.play();
            }).delay(gifDuration) // Wait this time before removing this image.
              .fadeOut(1e2, function() { // Remove the image with a fade out.
                const t = $(this);

                // Remove either the img tag or video tag.
                if (t.find('img').length > 0) {
                    // Remove the image.
                    t.find('img').remove();
                } else {
                    // Remove the video.
                    t.find('video').remove();
                }

                // Stop the audio.
                audio.pause();
                // Reset the duration.
                audio.currentTime = 0;
                // Mark as done playing.
                isPlaying = false;
            });
        }
    }

    /*
     * @event Called once the socket opens.
     */
    webSocket.onopen = function() {
        console.log('Successfully connected to the socket.');
        // Authenticate with the socket.
        sendToSocket({
            authenticate: getAuth()
        });
    };

    /*
     * @event Called when the socket closes.
     */
    webSocket.onclose = function() {
        console.error('Disconnected from the socket.');
    };

    /*
     * @event Called when we get a message.
     *
     * @param {Object} e
     */
    webSocket.onmessage = function(e) {
        try {
            let rawMessage = e.data,
                message = JSON.parse(rawMessage);

            if (message.query_id === undefined) {
                // Check for our auth result.
                if (message.authresult !== undefined) {
                    if (message.authresult === 'true') {
                        console.log('Successfully authenticated with the socket.');
                    } else {
                        console.error('Failed to authenticate with the socket.');
                    }
                } else

                    // Queue all events and process them one at-a-time.
                    if (message.alert_image !== undefined || message.audio_panel_hook !== undefined) {
                        queue.push(message);
                    }

                // Message cannot be handled error.
                else {
                    console.error('Failed to process message from socket: ' + rawMessage);
                }
            }
        } catch (ex) {
            console.error('Failed to parse socket message [' + e.data + ']: ' + e.stack);
        }
    };

    // Handle processing the queue.
    setInterval(handleQueue, 5e2);
});
