const functions = require('firebase-functions');

const {db,admin} = require('./util/admin')

const { commentOnPost, getAllPosts, postOnePost,getPost,likePost,unlikePost} = require('./handlers/posts')



const {signup,login, uploadImage, addUserDetails,getAuthUser,getUserDetails,markNotificationsRead} = require('./handlers/users')


const FBAuth = require('./util/fbAuth')




const express = require('express')
const app = express()






//post routes
app.get('/posts', getAllPosts )
//FBAuth is middleware that acts as authorization for protected routes
app.post('/post', FBAuth, postOnePost)
app.get('/post/:postId',getPost)

app.get('/post/:postId/like', FBAuth, likePost)

app.get('/post/:postId/unlike', FBAuth, unlikePost)


app.post('/post/:postId/comment', FBAuth, commentOnPost)



//user routes
app.post('/signup', signup)
app.post('/login', login)
app.post('/user/image', FBAuth, uploadImage)
app.post('/user', FBAuth, addUserDetails)
app.get('/user', FBAuth, getAuthUser)
app.get('/user/:handle',getUserDetails)
app.post('/notifications', FBAuth, markNotificationsRead)






exports.api = functions.https.onRequest(app)

//notification database trigger
exports.createNotificationLike = functions.firestore.document('likes/{id}').onCreate(snapshot => {
      return db
        .doc(`/posts/${snapshot.data().postId}`)
        .get()
        .then((doc) => {
          if (
            doc.exists &&
            doc.data().userHandle !== snapshot.data().userHandle
          ) {
            return db.doc(`/notifications/${snapshot.id}`).set({
              createdAt: new Date().toISOString(),
              recipient: doc.data().userHandle,
              sender: snapshot.data().userHandle,
              type: 'like',
              read: false,
              screamId: doc.id
            });
          }
        })
        .catch((err) => console.error(err));
});
exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}').onDelete(snapshot => {
    return db
    .doc(`/notifications/${snapshot.id}`)
    .delete()
    .catch((err) => {
      console.error(err);
      return;
    });
})

exports.createNotificationComment = functions.firestore.document("comments/{id}").onCreate(snapshot => {
    return db
    .doc(`/posts/${snapshot.data().postId}`)
    .get()
    .then((doc) => {
      if (
        doc.exists &&
        doc.data().userHandle !== snapshot.data().userHandle
      ) {
        return db.doc(`/notifications/${snapshot.id}`).set({
          createdAt: new Date().toISOString(),
          recipient: doc.data().userHandle,
          sender: snapshot.data().userHandle,
          type: 'comment',
          read: false,
          screamId: doc.id
        });
      }
    })
    .catch((err) => {
      console.error(err);
      return;
    });
})

exports.onUserImageChange = functions.firestore.document('/users/{userId}').onUpdate( change => {
    console.log(change.before.data().imageUrl)
    console.log(change.after.data().imageUrl)
    var storageRef = admin.storage().bucket();
  
   if(change.before.data().imageUrl !== change.after.data().imageUrl)
   {
    var previousImage = change.before.data().imageUrl;
    let imageName = previousImage.match(/o\/(.*?)(\?|$)/)[1];
    console.log('Previous iamge: ')
    console.log(imageName)

    var imageRef = storageRef.file(imageName);

    // Delete the file
    imageRef.delete().then(function() {
        // File deleted successfully
        console.log("previous user image deleted! ")
    })
    .catch(function(error) {
      // Uh-oh, an error occurred!
      console.log(error)
    });
    const batch = db.batch()

    return db.collection('posts').where('userHandle' , '==', change.before.data().handle).get()
    .then(data => {
        data.forEach(doc =>{
            const post = db.doc(`/posts/${doc.id}`)
            batch.update(post, {userImage : change.after.data().imageUrl})
        })
        return batch.commit()
    })
   } else return true
})
//delete everything that is related to the post trigger
exports.onPostDelete = functions.firestore.document('/posts/{postId}').onDelete((snapshot,context) => {
    const postId = context.params.postId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('postId', '==', postId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`)); //delete all comments relating to post
        });
        return db //then send the likes to the next then block
          .collection('likes')
          .where('postId', '==', postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`)); //delete all likes
        });
        return db //send notifiations to next then block
          .collection('notifications')
          .where('postId', '==', postId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`)); //delete them
        });
        return batch.commit(); //commit changes
      })
      .catch((err) => console.error(err));
})