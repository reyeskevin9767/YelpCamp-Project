var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");
var request = require("request");
var Campground = require("../models/campground");
var async = require("async");
var nodemailer = require("nodemailer");
var middleware = require("../middleware");
var multer = require('multer');
var crypto = require("crypto");

//===========================================================================================================

var storage = multer.diskStorage({
    filename: function (req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter })

var cloudinary = require('cloudinary');
cloudinary.config({
    cloud_name: 'ds5wtczl2',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

//ROUTE ROUTE
router.get("/", function (req, res) {
    res.render("landing");
});

//===========================================================================================================

//USERS PROFILE
//SHOW
router.get("/users/:id", function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        if (err) {
            req.flash("error", "Something went wrong");
            res.redirect("back");

        }
        if (foundUser) {
            Campground.find().where("author.id").equals(foundUser.id).exec(function (err, campgrounds) {
                if (err) {
                    req.flash("error", "User No Longer Exists");
                    res.redirect("/");
                }
                res.render("users/show", { user: foundUser, campgrounds: campgrounds });
            });
        } else {
            req.flash("error", "User No Longer Exists");
            res.redirect("back");
        }


    });
});

//===========================================================================================================
router.get("/users/:id/edit", function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        if (err) {
            req.flash("error", "Something went wrong");
            res.redirect("/");
        }

        res.render("users/edit", { user: foundUser });
    });

});

//===========================================================================================================

router.put("/users/:id", upload.single('image'), function (req, res) {
    User.findById(req.params.id, async function (err, updatedUsers) {
        if (err) {
            req.flash("error", "User Could Not Be Updated");
            res.redirect("back");
        } else {
            if (req.file) {
                try {
                    await cloudinary.v2.uploader.destroy(updatedUsers.imageId);
                    var result = await cloudinary.v2.uploader.upload(req.file.path);
                    updatedUsers.imageId = result.public_id;
                    updatedUsers.image = result.secure_url;
                } catch (err) {
                    req.flash("error", "User Could Not Be Updated");
                    return res.redirect("back");
                }
            }
        }

        updatedUsers.firstName = req.body.firstname;
        updatedUsers.lastName = req.body.lastname;
        updatedUsers.email = req.body.email;
        updatedUsers.description = req.body.description;

        updatedUsers.save();
        res.redirect("/users/" + req.params.id);
    });

});

//===========================================================================================================
//DELETE
router.delete('/users/:id', function (req, res) {

    User.findById(req.params.id, async function (err, deleteUser) {
        if (err) {
            req.flash("error", "User Could Not Be Deleted");
            return res.redirect("back");
        }
        try {
            await cloudinary.v2.uploader.destroy(deleteUser.imageId);
            deleteUser.remove();
            req.flash('success', 'User Deleted successfully!');
            res.redirect('/campgrounds');
        } catch (err) {
            if (err) {
                req.flash("error", "User Could Not Be Deleted");
                return res.redirect("back");
            }
        }
    });

});



//================
//AUTH ROUTES
//================

// show register form
router.get("/register", function (req, res) {
    res.render("register", { page: 'register' });
});

//handle sign up logic
router.post("/register", upload.single('image'), function (req, res) {
    cloudinary.v2.uploader.upload(req.file.path, function (err, result) {
        if (err) {
            req.flash('error', "Another User Has That Email");
            return res.redirect('back');
        }
        // add cloudinary url for the image to the campground object under image property
        req.body.image = result.secure_url;
        // add image's public_id to campground object
        req.body.imageId = result.public_id;
        // add author to campground


        var newUser = new User({
            username: req.body.username,
            firstName: req.body.firstname,
            lastName: req.body.lastname,
            email: req.body.email,
            description: req.body.description,
            image: req.body.image,
            imageId: req.body.imageId,
        });

        if (req.body.adminCode === process.env.AdminCode) {
            newUser.isAdmin = true;
        }

        User.register(newUser, req.body.password, function (err, user) {
            if (err) {
                console.log(err);
                return res.render("register", { "error": "Sorry, You Were Unable To Sign Up" });
            }
            passport.authenticate("local")(req, res, function () {
                req.flash("success", "Successfully Signed Up! Nice to meet you " + req.body.username);
                res.redirect("/campgrounds");
            });
        });
    });

});

//show login form
router.get("/login", function (req, res) {
    res.render("login", { page: 'login' });
});

// handling login logic
router.post("/login", passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
    failureFlash: true,
    successFlash: 'Welcome to YelpCamp!'
}), function (req, res) {});

// logout route
router.get("/logout", function (req, res) {
    req.logout();
    req.flash("success", "See you later!");
    res.redirect("/campgrounds");
});

// forgot password
router.get('/forgot', function (req, res) {
    res.render('forgot');
});

router.post('/forgot', function (req, res, next) {
    async.waterfall([
    function (done) {
            crypto.randomBytes(20, function (err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
    },
    function (token, done) {
            User.findOne({ email: req.body.email }, function (err, user) {
                if (!user) {
                    console.log(user);
                    req.flash('error', 'No account with that email address exists.');
                    return res.redirect('/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function (err) {
                    done(err, token, user);
                });
            });
    },
    function (token, user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: 'yelpcampfp@gmail.com',
                    pass: process.env.GMAILPW
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'yelpcampfp@gmail.com',
                subject: 'Node.js Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'https://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                console.log('mail sent');
                req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
    }
  ], function (err) {
        if (err) return next(err);
        res.redirect('/forgot');
    });
});

router.get('/reset/:token', function (req, res) {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('reset', { token: req.params.token });
    });
});

router.post('/reset/:token', function (req, res) {
    async.waterfall([
    function (done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
                if (!user) {
                    req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('back');
                }
                if (req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function (err) {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;

                        user.save(function (err) {
                            req.logIn(user, function (err) {
                                done(err, user);
                            });
                        });
                    })
                } else {
                    req.flash("error", "Passwords do not match.");
                    return res.redirect('back');
                }
            });
    },
    function (user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: 'yelpcampfp@gmail.com',
                    pass: process.env.GMAILPW
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'yelpcampfp@mail.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            };
            smtpTransport.sendMail(mailOptions, function (err) {
                req.flash('success', 'Success! Your password has been changed.');
                done(err);
            });
    }
  ], function (err) {
        res.redirect('/campgrounds');
    });
});




module.exports = router;
