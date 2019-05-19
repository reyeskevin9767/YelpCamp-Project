var mongoose = require("mongoose");

//Schema Setup for the campgrounds
var campgroundSchema = new mongoose.Schema({
    name: String,
    price: String,
    image: String,
    imageId: String,
    description: String,
    location: String,
    lat: Number,
    lng: Number,
    createdAT: { type: Date, default: Date.now },
    views: { type: Number, default: 0 },
    //References the User id and stores it into the author id
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    //References the comments and place them in a array
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }]
});

module.exports = mongoose.model("Campground", campgroundSchema);
