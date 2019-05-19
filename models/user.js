var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

//Schema Setup for users
var UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: String,
    image: String,
    imageId: String,
    firstName: String,
    lastName: String,
    email: { type: String, unique: true, required: true },
    description: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    isAdmin: { type: Boolean, default: false },
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);
