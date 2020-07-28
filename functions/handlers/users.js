


const {db,admin} = require('../util/admin')

const firebase = require('firebase')

const config =  require('../util/config')



firebase.initializeApp(config)

const {validateSignupData, validateLoginData, reduceUserDetails} = require('../util/validators')

exports.signup = (req,res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    }

    const {valid, errors } = validateSignupData(newUser)
    if(!valid) return res.status(400).json(errors)

    const noImg = 'default.png'
    //Validate data
    let token,userId 
    db.doc(`/users/${newUser.handle}`).get()
    .then(doc => {
        if(doc.exists )
        {
            return res.status(400).json({handle : "this handle is already taken"})
        }
        else
        {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email,newUser.password)
        }
    })
    .then(data => {
        userId = data.user.uid
        return data.user.getIdToken()
    })
    .then(idToken => {
        token = idToken
        const userCreds = {
            handle : newUser.handle,
            email : newUser.email,
            createAt : new Date().toISOString(),
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
            userId
        }
        return db.doc(`/users/${newUser.handle}`).set(userCreds)

    })
    .then( () => {
        return res.status(201).json({token})
    })
    .catch(err => {
        console.error(err)
        if(error.code === 'auth/email-already-in-use')
        {
            return ResultStorage.status(400).json({email : 'Email already in use'})
        }
        else{
            return res.status(500).json({ general : 'Something went wrong, try again' })
        }
      
    })
}

exports.login = (req,res) => {
    const user = {
        email : req.body.email,
        password : req.body.password
    }
    const {valid, errors } = validateLoginData(user)
    if(!valid) return res.status(400).json(errors)
  
    firebase.auth().signInWithEmailAndPassword(user.email,user.password)
    .then(data => {
        return data.user.getIdToken()
    })
    .then(token => {
        return res.json({token})

    })
    .catch(err => {
        
        return res.status(403).json({general : "Wrong credentials, try again"})
    
    
    })
}
//user details
exports.addUserDetails = (req, res) => {
    let userDetails = reduceUserDetails(req.body)

    db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(()=>{
        return res.json({message: 'Details added'})
    })
    .catch(err => {
        console.error(err)
        return res.status(500).json({error :err.code})
    })
}
//get user details
exports.getAuthUser = (req,res) => {
    let userData = {}


    db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
        if(doc.exists)
        {
            userData.credentials = doc.data()
            return db.collection('likes').where('userHandle', '==', req.user.handle).get()

        }
    })
    .then(data => {
        userData.likes = []
        data.forEach(doc => {
            userData.likes.push(doc.data())
        })
        return db.collection('notifications').where('recipient', '==', req.user.handle)
        .orderBy('createdAt', 'desc').limit(10).get()
    })
    .then(data =>{
        userData.notifications = []
        data.forEach(doc => {
            userData.notifications.push({
                recipient : doc.data().recipient,
                sender : doc.data().sender,
                createdAt : doc.data().createdAt,
                postId : doc.data().postId,
                type: doc.data().type,
                read : doc.data().read,
                notificationId : doc.id

            })
        })
        return res.json(userData)
    })
    .catch(err => {
        console.error(err)
        return res.status(500).json({ error : err.code})
    })
}
//upload photo for user profile picture 
exports.uploadImage = (req,res) => {
    const BusBoy = require('busboy')
    const path = require('path')
    const os = require('os')
    const fs = require('fs')

    const busboy = new BusBoy({headers : req.headers })


    let imageFileName
    let image2BeUploaded = {}
    busboy.on('file', (fieldname,file, filename,encoding,mimetype) => {
        //image.png
        if(mimetype !== 'image/jpeg' && mimetype !== 'image/png' && mimetype !== 'image/gif')
        {
            return res.status(400).json({error : 'wrong file type submitted'})
        }
        console.log(fieldname)
        console.log(filename)
        console.log(mimetype )
        const imageExtension = filename.split('.')[filename.split('.').length -1]
        imageFileName = `${Math.round(Math.random() * 1000000000000).toString()}.${imageExtension}`;

        const filepath = path.join(os.tmpdir(),imageFileName)
        image2BeUploaded = {filepath, mimetype}

        file.pipe(fs.createWriteStream(filepath))

    })
    busboy.on('finish', () => {
        admin.storage().bucket().upload(image2BeUploaded.filepath, {
            resumable: false,
            metadata : {
                metadata : {
                    contentType: image2BeUploaded.mimetype
                }
            }
        })
        .then(() => {
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`
            return db.doc(`/users/${req.user.handle}`).update({imageUrl : imageUrl})
        })
    .then(() => {
        return res.json({message : "image upload success!"})
    })
    .catch( err => {
        console.error(err)
        return res.status(500).json({error : err.code})
    })
    })
    busboy.end(req.rawBody)
}

exports.getUserDetails = (req,res) => {
    let userData = {}
    db.doc(`/users/${req.params.handle}`).get()
    .then(doc => {
        if(doc.exists)
        {
            userData.user = doc.data()
            return db.collection('posts').where('userHandle', '==', req.params.handle)
            .orderBy('createdAt', 'desc')
            .get()
        }
        else {
            return res.status(404).json({error : "user not found"})
        }
    })
    .then(data => {
        userData.posts = []
        data.forEach(doc => {
            userData.posts.push({
                body :doc.data().body,
                createdAt :doc.data().createdAt,
                userHandle :doc.data().userHandle,
                userImage :doc.data().userImage,
                likeCount :doc.data().likeCount,
                commentCount :doc.data().commentCount,
                postId : doc.id

            })
        })
        return res.json(userData)
    })
    .catch(err => {
        console.error(err)
        return res.status(500).json({error : err.code })
    })
}

exports.markNotificationsRead = (req,res) => {
    let batch = db.batch()
    req.body.forEach(notID => {
        const notiification = db.doc(`/notifications/${notID}`)
        batch.update(notiification, {read : true})
    })
    batch.commit()
    .then(() => {
        return res.json({message : 'Notfications marked read'})
    })
    .catch(err => {
        console.error(err)
        return res.status(500).json({error : err.code})
    })
}