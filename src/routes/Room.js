import { Suspense, useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Canvas, useThree } from "react-three-fiber";
import {
  OrbitControls,
  useAspect,
  MeshWobbleMaterial,
  Effects,
} from "@react-three/drei/";
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Noise,
  Vignette,
  Glitch,
  ChromaticAberration,
  Grid,
  Pixelation,
  DotScreen,
  ToneMapping,
} from "@react-three/postprocessing";

const Scene = ({ myVid }) => {
  const { viewport } = useThree();

  const [x, y] = useAspect("cover", viewport.width, viewport.height);

  return (
    <mesh scale={[x, y, 1]}>
      <OrbitControls />
      <planeBufferGeometry args={[1, 1]} />
      <meshBasicMaterial>
        <videoTexture attach="map" args={[myVid.current]} />
      </meshBasicMaterial>
      <Suspense fallback={null}>
        <EffectComposer multisampling={0} smaa={false}>
          <Pixelation granularity={16} />
          <DotScreen opacity={0.1} scale={0.001} />
          {/* <ToneMapping
            adaptive={true}
            resolution={256}
            middleGrey={0.6}
            maxLuminance={8.0}
            averageLuminance={1.0}
            adaptationRate={1.0}
          /> */}
        </EffectComposer>
      </Suspense>
    </mesh>
  );
};

const Can = ({ myVid }) => {
  console.log(myVid);
  return (
    <Canvas
      gl={{ alpha: false, logarithmicDepthBuffer: true, precision: "lowp" }}
      orthographic
      colorManagement
      shadowMap
      camera={{ position: [0, 0, 100] }}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
      }}
    >
      <Scene myVid={myVid} />
    </Canvas>
  );
};

const Room = (props) => {
  const userVideo = useRef();
  const partnerVideo = useRef();
  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        userStream.current = stream;

        socketRef.current = io.connect("/");
        socketRef.current.emit("join room", props.match.params.roomID);

        socketRef.current.on("other user", (userID) => {
          callUser(userID);
          otherUser.current = userID;
        });

        socketRef.current.on("user joined", (userID) => {
          otherUser.current = userID;
        });

        socketRef.current.on("offer", handleRecieveCall);

        socketRef.current.on("answer", handleAnswer);

        socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
      });
  }, []);

  function callUser(userID) {
    peerRef.current = createPeer(userID);
    userStream.current
      .getTracks()
      .forEach((track) => peerRef.current.addTrack(track, userStream.current));
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  function handleNegotiationNeededEvent(userID) {
    peerRef.current
      .createOffer()
      .then((offer) => {
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  function handleRecieveCall(incoming) {
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
  }

  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
  }

  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socketRef.current.emit("ice-candidate", payload);
    }
  }

  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
  }

  function handleTrackEvent(e) {
    partnerVideo.current.srcObject = e.streams[0];
  }

  return (
    <div>
      <Can myVid={userVideo} />
      <video autoPlay ref={userVideo} muted style={{ display: "none" }} />
      <video autoPlay ref={partnerVideo} muted />
    </div>
  );
};

export default Room;
