const admin = require('firebase-admin')


var serviceAccount = require("../whosgoing.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://whosgoing-ce730.firebaseio.com",
  storageBucket: "whosgoing-ce730.appspot.com"
});

const db = admin.firestore()

module.exports = {db, admin}