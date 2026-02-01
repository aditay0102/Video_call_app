import React, { useState, useMemo, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import "./Home.css";

const Home = () => {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [newUser, setNewUser] = useState("");
  const [joined, setJoined] = useState(false);

  // Hardware states
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const SOCKET_URL = import.meta.env.VITE_SERVER_URL;
  const socket = useMemo(() => io(SOCKET_URL), []);

  const peerConnection = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStream = useRef(null);

  const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };

  /* ============================
     JOIN ROOM
  ============================ */
  const JoinRoom = async () => {
    if (!name || !room) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStream.current = stream;
      setJoined(true);
      socket.emit("join_room", name, room);

    } catch (err) {
      console.error("Media Access Error:", err);
    }
  };

  /* ============================
     ATTACH LOCAL STREAM AFTER UI RENDERS
  ============================ */
  useEffect(() => {
    if (joined && localVideoRef.current && localStream.current) {
      localVideoRef.current.srcObject = localStream.current;
    }
  }, [joined]);

  /* ============================
     TOGGLE MIC / CAMERA
  ============================ */
  const toggleMic = () => {
    if (!localStream.current) return;
    const audioTrack = localStream.current.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMicOn(audioTrack.enabled);
  };

  const toggleCamera = () => {
    if (!localStream.current) return;
    const videoTrack = localStream.current.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCamOn(videoTrack.enabled);
  };

  /* ============================
     PEER CONNECTION
  ============================ */
  const createPeerConnection = (targetId) => {
    const pc = new RTCPeerConnection(configuration);

    if (localStream.current) {
      localStream.current.getTracks().forEach(track => {
        pc.addTrack(track, localStream.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: targetId
        });
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

  /* ============================
     SOCKET EVENTS
  ============================ */
  useEffect(() => {
    socket.on("user-connected", async (newUserName, newUserSocketId) => {
      setNewUser(newUserName);

      const pc = createPeerConnection(newUserSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("offer", { offer, to: newUserSocketId });
    });

    socket.on("offer", async ({ offer, from, senderName }) => {
      setNewUser(senderName);

      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { answer, to: from });
    });

    socket.on("answer", async ({ answer }) => {
      if (!peerConnection.current) return;
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (!peerConnection.current) return;
      await peerConnection.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    });

    return () => {
      socket.off("user-connected");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  }, [socket]);

  /* ============================
     UI
  ============================ */
  return (
    <div className="app-wrapper">
      {!joined ? (
        <div className="login-container">
          <h1>Meetup</h1>
          <input
            type="text"
            placeholder="Your Name"
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Room ID"
            onChange={(e) => setRoom(e.target.value)}
          />
          <button className="join-btn" onClick={JoinRoom}>
            Start Meeting
          </button>
        </div>
      ) : (
        <div className="meeting-container">

          {/* REMOTE USER */}
          <div className="main-video-area">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="remote-video"
            />
            <div className="label-badge remote-name-label">
              {newUser || "Waiting for Peer..."}
            </div>
          </div>

          {/* LOCAL USER (ADMIN POPUP) */}
          <div className="admin-popup">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="local-video"
            />
            <div className="label-badge local-name-label">
              Me: {name}
            </div>
          </div>

          {/* CONTROLS */}
          <div className="control-bar">
            <button
              onClick={toggleMic}
              className={`icon-btn ${!isMicOn ? "off" : ""}`}
            >
              {isMicOn ? "🎤 Mute" : "🎙️ Unmute"}
            </button>

            <button
              onClick={toggleCamera}
              className={`icon-btn ${!isCamOn ? "off" : ""}`}
            >
              {isCamOn ? "📹 Stop Cam" : "📽️ Start Cam"}
            </button>

            <button
              className="icon-btn hangup"
              onClick={() => window.location.reload()}
            >
              📞 Hang Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
