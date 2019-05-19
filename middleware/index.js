var Campground = require("../models/campground");
var Comment = require("../models/comment");

//all the middleware goes here

var middlewareObj = {};


//Checks for the Owner of the Campground
//===========================================================================================================

middlewareObj.checkCampgroundOwnership = function (req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id, function (err, foundCampground) {
            if (err || !foundCampground) {
                req.flash("error", "Sorry, Campground Not Found");
                res.redirect("back");
            } else {
                // does user own the campground?
                if (foundCampground.author.id.equals(req.user.id) || req.user.isAdmin) {
                    req.campground = foundCampground;
                    next();
                } else {
                    req.flash("error", "Permission Denied");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You Need To Be Login");
        res.redirect("back");
    }
};


//Checks for the Owner of the Comment
//===========================================================================================================

middlewareObj.checkCommentOwnership = function (req, res, next) {
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, function (err, foundComment) {
            if (err || !foundComment) {
                req.flash('error', 'Sorry, that comment does not exist!');
                res.redirect("back");
            } else {
                // does user own the comment?
                if (foundComment.author.id.equals(req.user.id) || req.user.isAdmin) {
                    req.comment = foundComment;
                    next();
                } else {
                    req.flash("error", "Permission Denied");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You Need To Be Login");
        res.redirect("back");
    }
};


//Checks the user if their log in
//===========================================================================================================

middlewareObj.isLoggedIn = function (req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        req.flash("error", "You Need To Be Login");
        res.redirect("back");
    }

};



module.exports = middlewareObj;
