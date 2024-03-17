const express = require("express");
const app = express();
const server = require("http").createServer(app);
const KJUR = require("jsrsasign");
require("dotenv").config();
const cors = require("cors");
// const ZigoClient = require('./modal/Zigo')

app.use(express.json());
const mqtt = require("mqtt");
const {
  userData,
  topic,
  baseMqttTopic,
  moveManual,
  moveCamera,
  gotoHome,
  gotoDock,
  meetingEnd,
  batteryLevel,
  baseApiUrl,
  apiBatteryUrl,
  batteryCharge,
  appConnection,
  obstacle,
  callState,
  startCall,
  startMapping,
  stopMapping,
  deleteMap,
  mapState,
  readyState,
  mapStatus,
  homeState,
  warningState,
  speedControl,
  robotState,
  userState,
  dockState,
  onlineStatusUpdate,
} = require("./globalConfig");
const axios = require("axios");
const { generateSignat, generateSignatureMiddleware } = require("./middlewere");

function getKeyByValue(map, searchValue) {
  for (const [key, value] of map) {
    if (value === searchValue) {
      return key;
    }
  }
  // If the value is not found, you can return null or any other appropriate value.
  return null;
}

//   ------  mqtt configarartion ----------

const host = "sonic.domainenroll.com";
const port = "1883";
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${host}:${port}`;
const password = "de120467";
const username = "domainenroll";

// const host = "44.202.67.39";
// const port = "1883";
// const clientId = "tebo333user";
// const connectUrl = `mqtt://${host}:${port}`;
// const password = "tebo333"
// const username = "tebo333user"
// ------- mqtt connection ---------

const client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  username: username,
  password: password,
  reconnectPeriod: 1000,
});
// const userData = "/devlacus/hubo";
// var topic = "/devlacus/tebo";
// var topic = "/user_data";
// const baseMqttTopic = "Devlacus/Tebo/"
// var moveManual = "/move/manual"
// var moveCamera = "/move/camera"

var robotuuId = null;

client.on("connect", () => {
  // console.log("Connected");

  client.subscribe([topic], () => {
    // console.log(`Subscribe to topic '${topic}'`);
  });
  client.subscribe([userData], () => {
    // console.log(`Subscribe to topic '${userData}'`);
  });
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: "*", methods: "GET,HEAD,PUT,PATCH,POST,DELETE" }));

const PORT = process.env.PORT || 5000;

const connectedUsers = new Map();
let peerConnectedUser = new Map();
const robotLivestatus = new Map()
/**
 * @type {Map<string,[string]>}
 */
let rooms = new Map();
// it contain all the userId : socket id
const connectedTebo = new Map();

const validateRequestMiddleware = (req, res, next) => {
  const { sessionName, role, sessionKey, userIdentity } = req.body;
  if (!sessionName || !role || !sessionKey || !userIdentity) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  next();
};

app.get("/", (req, res) => {
  res.send("Tebo server is Running");
});
app.get("/test", (req, res) => {
  res.send("Tebo server is Running");
});
app.post("/test", generateSignat, (req, res) => {
  // console.log("xxx", req.body); // Should log the JSON body sent from Postman
  res.json({ message: "Test route response", body: req.body });
});

app.post("/generateSignature", generateSignatureMiddleware, (req, res) => {
//  console.log(req.body);
  res.json({ signature: req.signature });
});

app.get("/getRobotLiveStatus", (req, res) => {
  const myObject = {};
  robotLivestatus.forEach((value, key) => {
    myObject[key] = value;
});
   console.log(myObject,"📺📺📺📺");
   
    res.json({ robotStatus: myObject });
  });
app.use((err, req, res, next) => {
  // console.log({ body: req.body });
  // console.error(err.stack);
  res.status(500).send("Server error");
});

// app.post("/zego",
//   ZigoClient
// );


/**
 *
 * @param {*} map
 * @param {*} targetValue
 */
function deleteConnectedUserEntryByValue(map, targetValue) {
  for (let [key, value] of map) {
    if (value === targetValue) {
      map.delete(key);
      break; // Stop after deleting the first matching entry
    }
  }
}

io.use((socket, next) => {
  if (socket.handshake.query) {
    let callerId = socket.handshake.query.callerId;
    socket.user = callerId;
    next();
  }
});

io.on("connection", (socket) => {
  // console.log("==================================== it is connected");
  socket.emit("me", socket.id);

  socket.join(socket.user);
  // console.log(socket.user, "Connected", socket.id);
  connectedTebo.set(socket.user, socket.id);
  // console.log(connectedTebo,"==================================== it is connected");

  //  console.log(io.sockets?.clients(),"io.sockets.clients()")
  let userExisit = false;
  socket.on("call", (data) => {
    let calleeId = data.calleeId;
    let rtcMessage = data.rtcMessage;
    // console.log({ rtcMessage }, "*********");
    let roomId = data.roomId;
    //  let isRoomexist = rooms.has(roomId)
    //  if(!isRoomexist){
    //   rooms.set(roomId, [calleeId]);
    //  }
    console.log(connectedUsers, peerConnectedUser, "🥴", calleeId);
    // console.log(1, roomId);
    rooms.set(roomId, [calleeId]);
    // console.log(2, rooms);
    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      // rtcMessage: rtcMessage,
      roomId,
    });
  });

  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    rtcMessage = data.rtcMessage;
    const roomId = data.roomId;
    // console.log(3, { roomId });

    const room = rooms.get(roomId);
    // console.log(4, { room });
    // // room.push(callerId);
    // console.log(5, { room });
    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      rtcMessage: rtcMessage,
    });
  });

  socket.on("ICEcandidate", (data) => {
    // console.log("ICEcandidate data.calleeId", data.calleeId);
    let calleeId = data.calleeId;
    let rtcMessage = data.rtcMessage;

    socket.to(calleeId).emit("ICEcandidate", {
      sender: socket.user,
      rtcMessage: rtcMessage,
    });
  });

  socket.on("setuuid", (data) => {
    robotuuId = data;
    // topic = `/devlacus/tebo/${data}`
    // console.log(data, "uniqid");
  });

  socket.on("sentUserId", (userId) => {
    // console.log("userId:", userId);
    connectedUsers.set(userId, socket.id);

    // console.log(connectedUsers);
  });

  socket.on("acknowledgement", (acknowledgementData) => {
   let  acknowledgementId = acknowledgementData.id
   let getKeyOfTebo = getKeyByValue(peerConnectedUser, acknowledgementId);
   
    const socketId = connectedUsers.get(getKeyOfTebo);
// console.log("🎃😵‍💫😈🎃😵‍💫😈🎃😵‍💫😈🎃😵‍💫😈🎃😵‍💫😈",{socketId},{acknowledgementId},{connectedUsers});
    io.to(socketId).emit("CredentialAcknowledgement", acknowledgementData.status);
  });

  socket.on("sentToPhone", (mobileLogData) => {
    let  acknowledgementId = mobileLogData.id
    let getKeyOfTebo = getKeyByValue(peerConnectedUser, acknowledgementId);
    
     const socketId = connectedUsers.get(getKeyOfTebo);
      // console.log("🎃😵‍💫😈🎃😵‍💫😈🎃😵‍💫😈🎃😵‍💫😈🎃😵‍💫😈",{socketId},{acknowledgementId},{connectedUsers});
     io.to(socketId).emit("mobileLogData", mobileLogData.mobileLog);
   });
  
  socket.on("getSocketId", (userId) => {
    const socketId = connectedUsers.get(userId);
    socket.emit("getSocketId", socketId);
  });

  socket.on("disconnect", () => {
    // socket.broadcast.emit("callEnded");
    connectedUsers.forEach((value, key) => {
      if (value === socket.id) {
        
        rooms.forEach((partcpnts, roomId) => {
          // console.log(partcpnts,roomId,connectedUsers,{rooms},key,"oooooo");
          const isUserinRoom = partcpnts.some((p) => p === key);
          if (isUserinRoom) {
            partcpnts.forEach((pid) => {
              console.log(connectedTebo.get(pid),"connectedTebo.get(pid)");
              io.to(connectedUsers.get(pid) || connectedTebo.get(pid)).emit(
                "participantLeft",
                {
                  leftedUser: key,
                }
              );
            });
            // console.log(roomId,"oooooo roomId");

            rooms.delete(roomId);
            // console.log({rooms},"oooooo roomId");
          }
        });
        peerConnectedUser.forEach((userValue, userKey) => {
          peerConnectedUser.delete(key);
        });
        connectedTebo.forEach((connectedTeboValue, connectedTeboKey) => {});
        connectedUsers.delete(key);
      }
    });

    connectedTebo.forEach((value, key) => {
      if (value === socket.id) {
        robotLivestatus.delete(key);
          io.sockets.emit("liveStatus",{TeboUserId:key,status:false})
        console.log({ value }, { key }, { socket: socket.id });
        
        if (key.startsWith("TEBO")) {
          axios
            .post(baseApiUrl + onlineStatusUpdate, {
              robot_uuid: key,
              screen_online_status: false,
              robot_online_status: true,
            })
            .then((res) => true
            // console.log({ apiBatteryUrl: res })
            )
            .catch((error) => console.log({ error }));
        }
      }
    });

    // connectedUsers.delete(userId);
  });

  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    io.to(userToCall).emit("callUser", { signal: signalData, from, name });
    // console.log(connectedUsers, "connected user");
  });

  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("disconnect-user", (userId) => {
    connectedUsers.delete(userId);

    // console.log("User disconnected:", userId);
    // console.log(connectedUsers);
  });

  // The below code is for Mqtt

  client.on("message", (topic, message) => {
    const payload = message.toString();
    // Emit the custom event to the frontend
    const topicParts = topic.split("/");
    const dynamicPart = `/${topicParts.slice(3).join("/")}`;
    if (dynamicPart == batteryLevel) {
      var str = `'${payload}'`;
      str = str.replace(/[^0-9]/g, "");
      const teboId = connectedTebo.get(topicParts[2]);
      let batteryPercentage = parseInt(str, 10);
      let socketId = connectedUsers.get(topicParts[2]);

      // console.log({ apiBatteryUrl: topicParts[2] });
      axios
        .post(baseApiUrl + apiBatteryUrl, {
          robot_uuid: topicParts[2],
          charging: false,
          battery_level: batteryPercentage,
        })
        .then((res) =>
        true
        //  console.log({ apiBatteryUrl: res })
        )
        .catch((error) => console.log({ error }));

      io.to(teboId).emit("batteryPercentage", batteryPercentage);
    }
    if (dynamicPart == batteryCharge) {
      // var str = `'${payload}'`;
      // str = str.replace(/[^0-9]/g, "");

      let chargingState = payload === "true";
      const teboId = connectedTebo.get(topicParts[2]);
      io.to(teboId).emit("batteryCharge", chargingState);

      // console.log("====================================");
      // console.log(typeof payload, dynamicPart, payload, chargingState);
      // console.log("====================================");
      // io.to(socketId).emit("mqttMessageReceived", payload);

      axios
        .post(baseApiUrl + apiBatteryUrl, {
          robot_uuid: topicParts[2],
          charging: chargingState,
          battery_level: null,
        })
        .then((res) => true
        // console.log({ apiBatteryUrl: res })
        )
        .catch((error) => console.log({ error }));
    }
    if (dynamicPart == appConnection) {
      let parsePayload = JSON.parse(payload);

      let socketId = connectedUsers.get(parsePayload.robot_uuid);
      io.to(socketId).emit("mqttMessageReceived", payload);
    }
    const key = getKeyByValue(peerConnectedUser, topicParts[2]);
    const keyBeforCall = getKeyByValue(connectedTebo, topicParts[2]);

    //  console.log(dynamicPart,"dynamicPart");
    if (dynamicPart == obstacle) {
      let socketId = connectedUsers.get(key);
      io.to(socketId).emit("obstacleDetected", payload);
    }

    if (dynamicPart == homeState) {
      let socketId = connectedUsers.get(key);
      io.to(socketId).emit("homeStatusChanged", payload);
    }
    if (dynamicPart == robotState) {
      // let robotStatus = false;
      // let userScreenStatus = false;
      let socketId = connectedTebo.get(topicParts[2]);
      // console.log(
      //   { connectedTebo },
      //   { socketId },
      //   { keyBeforCall },
      //   { tebo: topicParts[2] }
      // );
      if (payload === "i am alive") {
        // console.log(
        //   "🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥"
        // );

        io.to(socketId).emit("robotState", true);
      }
    }

    if (dynamicPart == readyState) {
      let socketId = connectedUsers.get(key);
      io.to(socketId).emit("readyState", payload);
    }
    if (dynamicPart == warningState) {
      let socketId = connectedUsers.get(key);
      io.to(socketId).emit("homeStatusChanged", payload);
    }
    if (dynamicPart == dockState) {
      const teboId = connectedTebo.get(topicParts[2]);
      // console.log({ teboId }, "****************", payload);
      io.to(teboId).emit("dockStatus", payload);
    }

    if (dynamicPart == mapState || dynamicPart == dockState) {
      // console.log("deleteMap", mapState);

      let socketId = connectedUsers.get(key);
      // console.log(
      //   payload,
      //   "mapState",
      //   { connectedUsers },
      //   { peerConnectedUser },
      //   { connectedTebo },
      //   { key }
      // );
      io.to(socketId).emit("mapState", payload);
      io.sockets.emit("mapStatusBroadcastMessage", {
        [topicParts[2]]: payload,
      });
      if (
        payload === "no map" ||
        payload === "map exists" ||
        payload === "saving map" ||
        payload === "map deleted"
      ) {
        let statusData = null;
        switch (payload) {
          case "saving map":
            statusData = "map exists";
            break;
          case "map deleted":
            statusData = "no map";
            break;
          default:
            statusData = payload;
            break;
        }
        // console.log({ statusData });
        if (statusData) {
          axios
            .post(baseApiUrl + mapStatus, {
              status: statusData,
              robot_uuid: topicParts[2],
              delete: false,
            })
            .then((res) =>true
            //  console.log({ apiBatteryUrl: res })
             )
            .catch((error) => console.log({ error }));
        }
      }
    }

    if (dynamicPart == callState) {
      let socketId = connectedUsers.get(key);
      io.to(socketId).emit("call-state", payload);
    }

    // console.log(dynamicPart, "dynamicPart");

    // console.log(`Received MQTT message from topic '${topic}': ${payload}`);
  });

  // client.subscribe("Devlacus/Tebo/+/info/robotState", (err) => {
  //   if (err) {
  //     console.error("Failed to subscribe to robotState topic:", err);
  //   } else {
  //     console.log("Successfully subscribed to robotState topic");
  //   }
  // });

  socket.on("confirmuser", (payload) => {
    // console.log("Received confirmuser event:", payload);
    const data = JSON.stringify(payload);
    client.publish(userData, data, { qos: 0, retain: false }, (error) => {
      if (error) {
        console.error(error);
      }
    });

    // Handle the payload data or perform any necessary operations
  });

  // The below code is for sent the initial connection

  socket.on("sentTo", (data) => {
    // console.log(data);

    client.publish(topic, data, { qos: 0, retain: false }, (error) => {
      if (error) {
        console.error(error);
      }
    });

    // client.subscribe([topic], (data) => {
    //   console.log(`Subscribe to topic '${data}'`);
    // });
    // client.subscribe([userData], () => {
    //   console.log(`Subscribe to topic '${data}'`);
    // });
  });

  // sending movement commands to robot

  socket.on("move-manual", (payload) => {
    const data = payload?.data?.toString();
    const Id = payload?.Id;
    // console.log(
    //   "Received confirmuser event:",
    //   baseMqttTopic + `${Id}` + moveManual
    // );

    client.publish(
      baseMqttTopic + `${Id}` + moveManual,
      data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );

    // Handle the payload data or perform any necessary operations
  });

  // tilt camera
  socket.on("tilt-camera", (payload, Id) => {
    const data = payload?.data?.toString();

    // console.log(
    //   "Received confirmuser event:",
    //   baseMqttTopic + `${payload?.Id}` + moveCamera
    // );

    client.publish(
      baseMqttTopic + `${payload?.Id}` + moveCamera,
      data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  socket.on("userState", (id) => {
    client.publish(
      baseMqttTopic + `${id}` + userState,
      "i am alive",
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  // Start Call

  socket.on("start-call", (payload) => {
    const StartCallData = " ";
    client.publish(
      baseMqttTopic + `${payload?.id}` + startCall,
      StartCallData,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  // Start Mapping
  socket.on("start-mapping", (payload) => {
    // console.log("jjjjj", payload);
    const StartCallData = " ";
    client.publish(
      baseMqttTopic + `${payload?.id}` + startMapping,
      StartCallData,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  // stopMapping
  socket.on("stopMapping", (payload) => {
    // console.log("stopMapping", payload);
    let StopCallData = " ";
    client.publish(
      baseMqttTopic + `${payload?.id}` + stopMapping,
      StopCallData,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  socket.on("deleteMap", (payload) => {
    // console.log("deleteMap", payload);

    axios
      .post(baseApiUrl + mapStatus, {
        status: "no map",
        robot_uuid: payload,
        delete: true,
      })
      .then((res) => true 
      // console.log({ apiBatteryUrl: res })
      )
      .catch((error) => console.log({ error }));

    let StopCallData = " ";
    client.publish(
      baseMqttTopic + `${payload?.id}` + deleteMap,
      StopCallData,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error.message);
        }
      }
    );
  });
  // socket.on("start-mapping", (payload) => {
  //   console.log("Received start-mapping event");
  //   // Your server-side logic here
  // });

  // start-meeting
  socket.on("start-meeting", (payload) => {
    const callData = "call Started";
    // console.log(
    //   baseMqttTopic + `${payload?.id}` + callState,
    //   "baseMqttTopic +`${payload?.id}`+ callState,"
    // );
    client.publish(
      baseMqttTopic + `${payload?.id}` + callState,
      callData,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  // end-meeting
  socket.on("meeting-ended", (payload) => {
    const callData = "call ended";
    let targetTeboId = connectedTebo.get(payload?.id);
    io.to(targetTeboId).emit("callEnded", "call ended");
    // console.log(baseMqttTopic + `${payload?.id}` + callState, "call ended");
    socket.to(payload?.id).emit("callEndInfo", {
      data: callData,
    });

    client.publish(
      baseMqttTopic + `${payload?.id}` + callState,
      callData,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  socket.on("zoomData", (payload) => {
    let targetTeboId = connectedTebo.get(payload?.id);
    // console.log("zoom", { targetTeboId });
    socket.to(targetTeboId).emit("zoomCredentials", {
      payload,
    });
  });
  // Set Map User
  socket.on("setMapUser", (payload, callback) => {
    try {
      let targetId = payload?.toId;
      // const validater = (targetId) => {
      // console.log(1, { peerConnectedUser });

      const valuesOfArray = Array.from(peerConnectedUser.values());
      // console.log(2, { peerConnectedUser });

      let isUserCConnected = valuesOfArray.includes(targetId);

      let connectData = true;
      if (isUserCConnected) {
        connectData = false;
      }

      // }
      // const validater = await validateData(payload?.toId);

      if (connectData) {
        peerConnectedUser.set(payload.from, payload.toId);
        // console.log(peerConnectedUser, "peerConnectedUser");

        callback({
          success: true,
          message: "Mapping user successful",
          error: false,
        });
      } else {
        // console.log(2222);

        callback({
          success: true,
          message: "Mapping user not successful",
          error: true,
        });
      }

      // Assuming that the operation was successful, you can send a success response
    } catch (error) {
      // If an error occurs during the operation, you can send an error response
      callback({ success: false, message: error.message });
    }
  });

  // tilt camera
  socket.on("end-meeting", (payload) => {
    const data = payload?.data?.toString();

    // console.log(
    //   "Received confirmuser event:",
    //   baseMqttTopic + `${payload?.Id}` + moveCamera
    // );

    client.publish(
      baseMqttTopic + `${payload?.Id}` + moveCamera,
      data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  // GoTo Home
  socket.on("goto-home", (payload) => {
    const data = payload?.data?.toString();
    client.publish(
      baseMqttTopic + `${payload?.Id}` + gotoHome,
      data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });

  // speedControl
  socket.on("speedControl", (payload) => {
    const data = payload?.data?.toString();
    // console.log(payload, "payload");
    client.publish(
      baseMqttTopic + `${payload?.Id}` + speedControl,
      payload.data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });
  // Goto Dock
  socket.on("goto-Dock", (payload) => {
    const data = payload?.data?.toString();
    client.publish(
      baseMqttTopic + `${payload?.Id}` + gotoDock,
      data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });
  socket.on('onlineUserData',(onlineRes)=>{
    robotLivestatus.set(onlineRes.TeboUserId,onlineRes.status)
    
  })
  socket.on('onlineStatusUpdate',(onlineRes)=>{
    console.log('testing:',{onlineRes});
    robotLivestatus.set(onlineRes.TeboUserId,onlineRes.status)
    io.sockets.emit("liveStatus",onlineRes)
    
    console.log({robotLivestatus});
  })

  
  // Goto Meeting End
  socket.on("meeting-end", (payload) => {
    const data = payload?.data?.toString();
    // deleteConnectedUserEntryByValue(peerConnectedUser, payload?.myId);
    peerConnectedUser.delete(payload?.myId);
    rooms.forEach((partcpent, roomId) => {
      let roomDataWebId = partcpent.some((p) => p === payload?.myId);
      let roomDataAppId = partcpent.some((p) => p === payload?.Id);
      if (roomDataWebId) {
        rooms.delete(roomId);
      }
      if (roomDataAppId) {
        rooms.delete(roomId);
      }
    });
    // console.log(6, { rooms });

    client.publish(
      baseMqttTopic + `${payload?.Id}` + meetingEnd,
      data,
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
