var mongoose = require("mongoose");

//Schema Setup for the comments
var commentSchema = new mongoose.Schema({
    text: String,
    createdAT: { type: Date, default: Date.now },
    //references the user id and stores into the author id
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    }
});

module.exports = mongoose.model("Comment", commentSchema);
