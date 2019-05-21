var express = require('express');
var router = express.Router();
var models = require('../models/');
var middleware = require('./middleware.js');

var User = models.User;

router.get('/:id', middleware.isAllowed, async function (req, res, next) {

    let user = await User.findOne({
        where: {
            id: req.params.id
        }
    });

    res.render('users', {
        errorMessages: 0,
        title: 'AC scrum vol2',
        pageName: 'edit_user',
        isUser: req.user.is_user,
        username: req.user.username,
        success: 0,
        edit_name: user.name,
        edit_surname: user.surname,
        edit_email: user.email,
        edit_username: user.username,
        edit_isUser: user.is_user
    });
});

module.exports = router;
