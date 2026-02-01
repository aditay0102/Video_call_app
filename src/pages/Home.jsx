import React, { useState, useMemo, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import "./Home.css";


const Home = () => {
    const [name, SetName] = useState("");
    const [room, SetRoom] = useState("");
    const [newUser, SetNewUsers] = useState("");
    const [joined, setJoined] = useState(false);
    
    // Hardware states
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCamOn, setIsCamOn] = useState(true);

    const SOCKET_URL = import.meta.env.VITE_SERVER_URL;
    const socket = useMemo(() => io(SOCKET_URL), []);
    const peerConnection = useRef();
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const localStream = useRef();

    const configuration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };

    const JoinRoom = async () => {
        if (name && room) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStream.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setJoined(true);
                socket.emit("join_room", name, room);
            } catch (err) {
                console.error("Media Access Error:", err);
            }
        }
    };

    // Toggle Hardware logic
    const toggleMic = () => {
        const audioTrack = localStream.current.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
    };

    const toggleCamera = () => {
        const videoTrack = localStream.current.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOn(videoTrack.enabled);
    };

    const createPeerConnection = (targetId) => {
        const pc = new RTCPeerConnection(configuration);
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => {
                pc.addTrack(track, localStream.current);
            });
        }
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { candidate: event.candidate, to: targetId });
            }
        };
        pc.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };
        peerConnection.current = pc;
        return pc;
    };

    useEffect(() => {
        socket.on("user-connected", async (newUserName, newUserSocketId) => {
            SetNewUsers(newUserName);
            const pc = createPeerConnection(newUserSocketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", { offer, to: newUserSocketId });
        });

        socket.on("offer", async ({ offer, from, senderName }) => {
            SetNewUsers(senderName);
            const pc = createPeerConnection(from);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer", { answer, to: from });
        });

        socket.on("answer", async ({ answer }) => {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on("ice-candidate", async ({ candidate }) => {
            if (peerConnection.current) {
                await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        return () => {
            socket.off("user-connected");
            socket.off("offer");
            socket.off("answer");
            socket.off("ice-candidate");
        };
    }, [socket]);

    return (
        <div className="app-wrapper">
            {!joined ? (
                <div className="login-container">
                    <h1>Meetup</h1>
                    <input type='text' onChange={(e) => SetName(e.target.value)} placeholder='Your Name' />
                    <input type='text' onChange={(e) => SetRoom(e.target.value)} placeholder='Room ID' />
                    <button className="join-btn" onClick={JoinRoom}>Start Meeting</button>
                </div>
            ) : (
                <div className="meeting-container">
                    {/* REMOTE USER (FULL SCREEN) */}
                    <div cla  ssName="main-video-area">
                        <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                        <div className="remote-name-label">{newUser || "Waiting for Peer..."}</div>
                    </div>

                    {/* ADMIN USER (SMALL CORNER POPUP) */}
                  
                    <div className="admin-popup">
                        <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
                        <div className="local-name-label">Me: {name}</div>
                    </div>
                   

                    {/* CONTROL BAR */}
                    <div className="control-bar">
                        <button onClick={toggleMic} className={`icon-btn ${!isMicOn ? 'off' : ''}`}>
                            {isMicOn ? "🎤 Mute" : "🎙️ Unmute"}
                        </button>
                        <button onClick={toggleCamera} className={`icon-btn ${!isCamOn ? 'off' : ''}`}>
                            {isCamOn ? "📹 Stop Cam" : "📽️ Start Cam"}
                        </button>
                        <button className="icon-btn hangup" onClick={() => window.location.reload()}>
                            📞 Hang Up
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;