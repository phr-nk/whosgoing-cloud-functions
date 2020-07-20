const {db} = require('../util/admin')
//get all posts
exports.getAllPosts = (req,res) => {
    db.collection('posts').orderBy('createdAt', 'desc').get().then(data => {
        let posts = []
        data.forEach(doc => {
            posts.push({
                postID: doc.id,
                body: doc.data().body,
                userHandle: doc.data().userHandle,
                createdAt: doc.data().createdAt,
                userImage : doc.data().userImage,
                likeCount : doc.data().likeCount,
                commentCount : doc.data().commentCount
            })
        })
        return res.json(posts)
    })
    .catch(err => console.error(err))
}
//make one post
exports.postOnePost = (req,res) => {
    const newPost = {
        body: req.body.body,
        userHandle: req.user.handle,
        userImage: req.user.imageUrl,
        likeCount: 0,
        commentCount:0,
        createdAt: new Date().toISOString()

    }
    db.collection('posts').add(newPost).then( doc => {
        const resPost = newPost
        resPost.postId = doc.id
        res.json(resPost)
    })
    .catch(err => {
        res.status(500).json({error : 'something went wrong'})
        console.error(err)
    })

}
//get one post
exports.getPost =(req,res) => {
    let postData = {}

    db.doc(`/posts/${req.params.postId}`).get()
    .then(doc => {
        if(!doc.exists)
        {
            return res.status(404).json({error:"Post not found"})
        }
        postData = doc.data()
        postData.postId = doc.id
        return db.collection('comments').orderBy('createdAt', 'desc').where('postId','==', req.params.postId).get()
        .then(data => {
            postData.comments = []

            data.forEach(doc => {
                postData.comments.push(doc.data())
            })
            return res.json(postData)
        })
        .catch(err => {
            console.error(err)
            return res.status(500).json ({error :err.code})
        })
    })
}

//make one comment
exports.commentOnPost = (req, res) => {
    if(req.body.body.trim() === '') return res.status(400).json({ comment : "Must not be empty"})
    

    let newComment = {
        body : req.body.body,
        createdAt : new Date().toISOString(),
        postId : req.params.postId,
        userHandle : req.user.handle,
        userImage : req.user.imageUrl
    }

    
    db.doc(`/posts/${req.params.postId}`).get()
    .then(doc => {
        if(!doc.exists)
        {
            return res.status(404).json({error : "Post does not exist"})
        }
        return db.collection("comments").add(newComment)
    })
    .then(() => {
        res.json(newComment)
    })
    .catch(err => {
        console.error(err)
        res.status(500).json({error : "something went wrong :("})
    })


}

exports.likePost = (req,res) => {
    const likeDoc = db.collection('likes')
    .where('userHandle', '==', req.user.handle)
    .where('postId', '==',req.params.postId).limit(1)

    const postDoc = db.doc(`/posts/${req.params.postId}`)

    let postData = {}

    postDoc.get().then(doc => {
        if(doc.exists)
        {
            postData = doc.data()
            postData.postId = doc.id
            return likeDoc.get()
        }
        else {
            return res.status(404).json({error : "post not found :( "})
        }
    })
    .then(data => {
        if (data.empty)
        {
            return db.collection('likes')
            .add({
                postId : req.params.postId,
                userHandle: req.user.handle
            })
            .then(() => {
                postData.likeCount++
                return postDoc.update({likeCount :postData.likeCount})
            })
            .then(() => {
                return res.json(postData)
            })
        }else {
            return res.status(400).json({error : 'post already liked'})
        }
    })
    .catch((err) => {
        console.error(err)
        res.status(500).json({error :err.code})
    })
}

exports.unlikePost = (req,res) => {
    const likeDoc = db.collection('likes').where('userHandle', '==', req.user.handle)
    .where('postId', '==',req.params.postId).limit(1)

    const postDoc = db.doc(`/posts/${req.params.postId}`)

    let postData = {}

    postDoc.get().then(doc => {
        if(doc.exists)
        {
            postData = doc.data()
            postData.postId = doc.id
            return likeDoc.get()
        }
        else {
            return res.status(404).json({error : "post not found :( "})
        }
    })
    .then(data => {
        if (data.empty)
        {
            return res.status(400).json({error : 'post not liked'})
            
        }else {
            return db.doc(`/likes/${data.docs[0].id}`).delete()
            .then(() => {
                postData.likeCount--
                return postDoc.update({likeCount:postData.likeCount})
            })
            .then(() => {
                return res.json(postData)
            })
        }
    })
    .catch((err) => {
        console.error(err)
        res.status(500).json({error :err.code})
    })

}