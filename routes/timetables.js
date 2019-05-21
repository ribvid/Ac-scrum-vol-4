var express = require('express');
var router = express.Router();
var models = require('../models/');

const User = models.User;
const Story = models.Story;
const Tasks = models.Tasks;
const Timetable = models.Timetable;

var middleware = require('./middleware.js');

var ProjectHelper = require('../helpers/ProjectHelper');
var TasksHelper = require('../helpers/TasksHelper');
var StoriesHelper = require('../helpers/StoriesHelper');
var TimetableHelper = require('../helpers/TimetableHelper');


//  ------------- read user time logs ----------------
router.get('/', middleware.ensureAuthenticated, async function (req, res, next) {
    let timeLogs = await TimetableHelper.listTimeLogs(req.user.id);

    res.render('timetables', {
        errorMessages: 0,
        success: 0,
        pageName: 'timetables',
        uid: req.user.id,
        username: req.user.username,
        isUser: req.user.is_user,
        timeLogs: timeLogs
    });

});

// ------------------ endpoint for editing a timelog ------------------
router.get('/edit/:id/', middleware.ensureAuthenticated, async function (req, res, next) {

    let toEditLog = await TimetableHelper.getLogToEdit(req.params.id);
    let toEditTask = await TasksHelper.getTask(toEditLog.task_id);
    res.render('edit_timelog', {
        errorMessages: 0, title: 'AC scrum vol2',
        pageName: 'timelog edit', username: req.user.username, toEditLog: toEditLog, toEditTask: toEditTask,
        isUser: req.user.is_user, success: 0
    });
});

// ------------------ endpoint for deleting a timelog ------------------
router.get('/delete/:id/', middleware.ensureAuthenticated, async function (req, res, next) {
    let to_delete = await TimetableHelper.getLogToEdit(req.params.id);
    let is_deleted = await TimetableHelper.deleteLogById(req.params.id);
    if (is_deleted) {
        await TasksHelper.update_logged(to_delete.task_id);
        return res.redirect('/timetables/');
    } else {
        return res.status(500).send('Delete failed')
    }
});

// ------------------ edit a timelog ------------------
router.post('/:id/edit/', middleware.ensureAuthenticated, async function (req, res, next) {

    let to_update = await TimetableHelper.getLogToEdit(req.params.id);
    let update_task = await TasksHelper.getTask(to_update.task_id);
    let data = req.body;

    to_update.setAttributes({
        //remainingTime: data.timeRemaining,
        loggedTime: data.loggedTime
    });
    await to_update.save();

    update_task.setAttributes({
        time: data.timeRemaining
    });
    await update_task.save();

    let is_updated = await TasksHelper.update_logged(update_task.id);

    if (is_updated) {
        return res.redirect('/timetables/edit/' + req.params.id);
    } else {
        return res.status(500).send('Update failed')
    }
});

module.exports = router;
