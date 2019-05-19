var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var User = require("../models/user");
var middleware = require("../middleware");
var request = require("request");



//Cloudinary API
//===========================================================================================================
var multer = require('multer');

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

//===========================================================================================================

//INDEX ROUTE
//INDEX - show all campgrounds
router.get("/", function (req, res) {
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    if (req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({ name: regex }).skip((perPage * pageNumber + 1) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.countDocuments({ name: regex }).exec(function (err, count) {
                if (err) {
                    console.log(err);
                    res.redirect("back");
                } else {
                    if (allCampgrounds.length === 0) {
                        req.flash('error', 'Sorry, no campgrounds match your query. Please try again');
                        return res.redirect('/campgrounds');
                    }
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),

                        search: req.query.search
                    });
                }
            });
        });
    } else {
        // get all campgrounds from DB
        Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).sort({ createdAT: 'desc' }).exec(function (err, allCampgrounds) {
            Campground.countDocuments().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        search: false
                    });
                }
            });
        });
    }
});

//===========================================================================================================

//CREATE ROUTE
router.post("/", middleware.isLoggedIn, upload.single('image'), function (req, res) {

    cloudinary.v2.uploader.upload(req.file.path, function (err, result) {
        if (err) {
            req.flash('error', "An image Is Required");
            res.redirect('new');
        }
        req.body.campground.image = result.secure_url; // add cloudinary url for the image to the campground object under image property
        req.body.campground.imageId = result.public_id; // add image's public_id to campground object
        req.body.campground.author = { // add author to campground
            id: req.user._id,
            username: req.user.username
        };

        //Campground is created
        Campground.create(req.body.campground, function (err, campground) {
            if (err) {
                req.flash('error', "The Campground Could Not Be Created");
                res.redirect('/campgrounds/new');
            }

            res.redirect('/campgrounds/' + campground.id);
        });
    });
});

//===========================================================================================================

//NEW ROUTE
router.get("/new", middleware.isLoggedIn, function (req, res) {
    res.render("campgrounds/new");
});

//===========================================================================================================

//SHOW ROUTE
router.get("/:id", function (req, res) {

    //Find the User Id and place into foundUser
    User.findById(req.params.id, function (err, foundUser) {

        //Found the campgound and comments that are link to it
        Campground.findById(req.params.id).populate("comments").exec(function (err, foundCampground) {
            if (err) {
                req.flash('error', "Sorry, Campground Could Not Be Founded");
                res.redirect("/campgrounds");
            } else {
                foundCampground.update({ $inc: { "views": 1 } }, function (err, views) {
                    if (err) {
                        req.flash('error', "Sorry, Views cannot be updated");
                    }

                    res.render("campgrounds/show", { campground: foundCampground, user: foundUser, views: views });
                });

            }
        });
    });
});

//===========================================================================================================

//EDIT CAMPGROUND ROUTE
router.get("/:id/edit", middleware.isLoggedIn, middleware.checkCampgroundOwnership, function (req, res) {
    Campground.findById(req.params.id, function (err, foundCampground) {
        if (err) {
            req.flash('error', "Sorry, Campground Could Not Be Edited");
            res.redirect("/campgrounds/" + foundCampground.id);
        } else {
            res.render("campgrounds/edit", { campground: foundCampground });
        }
    });
});

//===========================================================================================================

//UPDATE ROUTE
router.put("/:id", middleware.isLoggedIn, middleware.checkCampgroundOwnership, upload.single('image'), function (req, res) {

    Campground.findById(req.params.id, async function (err, campground) {
        if (err) {
            req.flash("error", "Campground Could Not Be Updated");
            res.redirect("/campgrounds/" + campground.id);
        } else {
            if (req.file) {
                try {
                    await cloudinary.v2.uploader.destroy(campground.imageId); //Deleted Image From Cloudinary
                    var result = await cloudinary.v2.uploader.upload(req.file.path); //Add New Image To Cloudinary
                    campground.imageId = result.public_id;
                    campground.image = result.secure_url;
                } catch (err) {
                    req.flash("error", "Image Could Not Be Updated");
                    res.redirect("/campgrounds/" + campground.id);
                }
            }
            campground.name = req.body.campground.name;
            campground.description = req.body.campground.description;
            campground.price = req.body.campground.price;
            campground.save();

            req.flash("success", "Successfully Updated!");
            res.redirect("/campgrounds/" + campground.id);
        }
    });

});

//===========================================================================================================

//DELETE ROUTE
router.delete('/:id', middleware.isLoggedIn, middleware.checkCampgroundOwnership, function (req, res) {

    Campground.findById(req.params.id, async function (err, campground) {
        if (err) {
            req.flash("error", "Campgound Not Be Deleted");
            res.redirect("/campgrounds/" + campground.id);
        }
        try {
            await cloudinary.v2.uploader.destroy(campground.imageId); //Delete Image From Cloundinary
            campground.remove();
            req.flash('success', 'Campground deleted successfully!');
            res.redirect('/campgrounds');
        } catch (err) {
            if (err) {
                req.flash("error", "Campground deleted successfully!");
                res.redirect("/campgrounds/" + campground.id);
            }
        }
    });
});

//===========================================================================================================

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
