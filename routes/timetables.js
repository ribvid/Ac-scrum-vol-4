var express = require('express');
var router = express.Router();
var models = require('../models/');
var moment = require('moment');

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
    let timeLogs = await TimetableHelper.listTimeLogsAll(req.user.id);
    //console.log(timeLogs);
    let dict = {};
    for (i in timeLogs){
        //console.log(i);
        log = timeLogs[i];
        id = log.task_id;
        //console.log(timeLogs[i]);
        //console.log(log.loggedDate);
        lt = moment(log.loggedDate).format("DD. MM. YYYY")
        console.log("handling--: ", log.task_id, lt, log.loggedTime)
        if(dict[id] == undefined){
            console.log("new ID, setting log...: ", id)
            dict[id] = {};
            dict[id][lt] = log;
            console.log("logged new ID: ", dict[id][lt].loggedTime)
        } else{
            console.log("old ID...: ", id)
            if(dict[id][lt] == undefined){
                dict[id][lt] = log;
                console.log("new date, setting log...: ", lt)
                console.log("logged new date: ", dict[id][lt].loggedTime)
            } else{
                console.log("old date, adding...: ", lt)
                dict[id][lt].loggedTime += log.loggedTime;
                console.log("logged after sum: ", dict[id][lt].loggedTime)
            }

        }
    }

    console.log("-------------------------------------------------")
    console.log(dict)


    res.render('timetablesAll', {
        errorMessages: 0,
        success: 0,
        pageName: 'timetables',
        uid: req.user.id,
        username: req.user.username,
        isUser: req.user.is_user,
        logs: dict
    });

});

//  ------------- read user time logs for task ----------------
router.get('/:id/', middleware.ensureAuthenticated, async function (req, res, next) {
    let timeLogs = await TimetableHelper.listTimeLogs(req.user.id, req.params.id);
    //console.log(timeLogs);
    let sprintDates = await TasksHelper.getTaskSprint(req.params.id);
    console.log(sprintDates.Story.Sprint.startDate);
    let currDate = moment(sprintDates.Story.Sprint.startDate);
    console.log(currDate);
    let lastDate = moment().startOf('day');
    console.log(lastDate);
    moment.defaultFormat = "DD.MM.YYYY HH:mm";

    let dict = {};

    for (i in timeLogs){
        log = timeLogs[i];
        lt = moment(log.loggedDate).format("DD. MM. YYYY")
        if(dict[lt] === undefined){
            dict[lt] = log;
            //console.log(log.id)
        } else{
            //console.log(log.loggedTime, log.task_id)
            dict[lt].loggedTime += log.loggedTime;
        }
    }

    let estimate = sprintDates.time;
    let story = sprintDates.Story.name;
    let ff = 1000;
    let insert;
    for (var m = currDate; m.diff(lastDate, 'days') <= 0; m.add(1, 'days')) {
        console.log(ff++);
        console.log(m.format("DD. MM. YYYY"));
        insert = null;
        if(dict[moment(currDate, moment.defaultFormat).format("DD. MM. YYYY")] == undefined){
            insert = {id: ff, remainingTime: estimate, loggedTime: 0.0, loggedDate: m.format("'YYYY-MM-DD hh:mm"), autoLoggedDate: m.format("'YYYY-MM-DD hh:mm")};
            insert.Task = {};
            insert.Task.Story = {}
            insert.Task.Story.Sprint = {}
            insert.Task.Story.Sprint.Project = {}
            insert.Task.Story.Sprint.Project.name = sprintDates.Story.Sprint.Project.name;
            insert.Task.Story.name = sprintDates.Story.name;
            insert.Task.desciption = sprintDates.description;
            insert.Task.name = sprintDates.name;
            insert.ghost = -1;
            insert.Task.status = sprintDates.status;

            dict[moment(currDate, moment.defaultFormat).format("DD. MM. YYYY")] = insert;
        }
        else{
            etimate = dict[moment(currDate, moment.defaultFormat).format("DD. MM. YYYY")].remainingTime;
        }
    }



    console.log("-------------------------------------------------")
    console.log(dict)


    res.render('timetables', {
        errorMessages: 0,
        success: 0,
        pageName: 'timetables',
        uid: req.user.id,
        username: req.user.username,
        isUser: req.user.is_user,
        task_name: sprintDates.name,
        logs: dict
    });

});

// ------------------ endpoint for editing a timelog ------------------
router.get('/getData/', middleware.ensureAuthenticated, async function (req, res, next) {

    let timeLogs = await TimetableHelper.listTimeLogs(req.user.id);
    console.log(timeLogs);
    let dict = {};
    for (i in timeLogs){
        console.log(i);
        log = timeLogs[i];
        id = log.Task.id;
        console.log(timeLogs[i]);
        console.log(log.loggedDate);
        lt = moment(log.loggedDate).format("DD. MM. YYYY")
        if(dict[id] === undefined){
            dict[id] = {};
            dict[id][lt] = log;
        } else{
            if(dict[id][lt] === undefined){
                dict[id][lt] = log;
            } else{
                dict[id][lt].loggedTime += log.loggedTime;
            }

        }
    }

    res.send(JSON.parse(JSON.stringify(dict)));
});



// ------------------ endpoint for editing a timelog ------------------
router.get('/edit/:id/', middleware.ensureAuthenticated, async function (req, res, next) {

    let toEditLog = await TimetableHelper.getLogToEdit(req.params.id);
    let toEditTask = await TasksHelper.getTask(toEditLog.task_id);
    res.render('edit_timelog', {
        errorMessages: 0, title: 'AC scrum vol2',
        pageName: 'timelog edit', username: req.user.username, toEditLog: toEditLog, toEditTask: toEditTask,
        isUser: req.user.is_user, success: 0, task_id: toEditTask.id
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
        remainingTime: data.timeRemaining/6,
        loggedTime: data.loggedTime
    });
    await to_update.save();

    update_task.setAttributes({
        time: data.timeRemaining
    });
    await update_task.save();

    let is_updated = await TasksHelper.update_logged(update_task.id);

    if (is_updated) {
        req.flash('success', 'Log has been successfully updated.');
        return res.redirect('/timetables/edit/' + req.params.id);
    } else {
        return res.status(500).send('Update failed')
    }
});

// ------------------ endpoint for adding a timelog ------------------
router.post('/add/', middleware.ensureAuthenticated, async function (req, res, next) {

    let data = req.body.data;

    console.log(moment(data[3], "DD. MM. YYYY HH:mm").format("YYYY-MM-DD HH:mm.SSS+HH"));

    const createdLog = Timetable.build({
        remainingTime: parseFloat(data[4])/6*1.0,
        loggedTime: 0.0,
        loggedDate: moment(data[3], "DD. MM. YYYY HH:mm").format("YYYY-MM-DD HH:mm.SSS+HH"),
        autoLoggedDate: moment(data[3], "DD. MM. YYYY HH:mm").format("YYYY-MM-DD HH:mm.SSS+HH"),
        task_id: parseInt(data[6]),
        loggedUser: req.user.id
    });

    await createdLog.save().then(function(newLog){
        res.send(JSON.parse(JSON.stringify('/timetables/edit/'+newLog.id+'/')));
    });
});

module.exports = router;
