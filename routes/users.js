var express = require('express');
var bcrypt = require('bcrypt');
var router = express.Router();
var models = require('../models/');
var middleware = require('./middleware.js');

var User = models.User;
var Project = models.Project;

router.get('/', middleware.ensureAuthenticated, async function (req, res, next) {
    res.redirect('/users/'+req.user.id)
});

router.get('/:id', middleware.ensureAuthenticated, async function (req, res, next) {

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
        edit_isUser: user.is_user,
        edit_userId: user.id
    });
});

router.post('/:id', middleware.ensureAuthenticated, async function (req, res, next) {
    let data = req.body;
    let user = await User.findOne({
        where: {
            id: req.params.id
        }
    });

    let errorMessages = 0;
    if (data.password !== data.password2) {
        req.flash('error', 'Passwords do not match.');
        errorMessages = req.flash('error');
    }

    else {
        user.setAttributes({
            username: data.username,
            password: data.password.length !== 0 ? bcrypt.hashSync(data.password, 10) : user.password,
            name: data.name,
            surname: data.surname,
            email: data.email,
            is_user: data.is_user ? 0 : 1
        });

        await user.save().catch(function (err) {
            req.flash('error', 'Error.');
            errorMessages = req.flash('error');
        });
    }

    if (errorMessages === 0)
        req.flash('success', user.username);

    res.render('users', {
        errorMessages: errorMessages,
        title: 'AC scrum vol2',
        pageName: 'edit_user',
        isUser: req.user.is_user,
        username: req.user.username,
        success: errorMessages === 0 ? req.flash('success') : 0,
        edit_name: user.name,
        edit_surname: user.surname,
        edit_email: user.email,
        edit_username: user.username,
        edit_isUser: user.is_user,
        edit_userId: user.id
    });

});

router.get('/:id/delete', middleware.ensureAuthenticated, async function (req, res, next) {

    let user = await User.findOne({
        where: {
            id: req.params.id
        }
    });

    let project = await Project.findOne({
        where: {
            [models.Sequelize.Op.or]: [{scrum_master: req.params.id}, {product_owner: req.params.id}]
        }
    });

    if (project) {
        req.flash('error', 'Error. User cannot be deleted because it is linked to an active project.');
        res.render('users', {
            errorMessages: req.flash('error'),
            title: 'AC scrum vol2',
            pageName: 'edit_user',
            isUser: req.user.is_user,
            username: req.user.username,
            success: 0,
            edit_name: user.name,
            edit_surname: user.surname,
            edit_email: user.email,
            edit_username: user.username,
            edit_isUser: user.is_user,
            edit_userId: user.id
        });
        return;
    }

    await user.destroy();
    res.redirect('/admin_panel')
});

module.exports = router;
