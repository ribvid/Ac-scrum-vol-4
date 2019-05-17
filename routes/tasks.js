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


//  ------------- create a task ----------------
router.get('/create/:projectId/:storyId', TasksHelper.checkIfSMorMember, async function(req, res, next) {
    let projectUsers = await ProjectHelper.getProjectMembers(req.params.projectId);

    let taskStory    = await StoriesHelper.getStory(req.params.storyId);
    let storyTasksTimeSum = 0;
    let storyTasks   = await TasksHelper.listTasks(req.params.storyId);
    for(var i = 0; i < storyTasks.length; i++){
        storyTasksTimeSum += storyTasks[i].time;
    }
    let available_time_for_new_task = (taskStory.estimatedTime - storyTasksTimeSum) > 0 ? taskStory.estimatedTime - storyTasksTimeSum : 0 ;
    let project = await ProjectHelper.getProject(req.params.projectId);

    res.render('add_edit_task', {
        errorMessages: 0,
        success: 0,
        pageName: 'tasks',
        uid: req.user.id,
        username: req.user.username,
        isUser: req.user.is_user,
        projectId: req.params.projectId,
        storyId: req.params.storyId,
        projectUsers: projectUsers,
        toEditTask: false,
        timeForNewTask:available_time_for_new_task,
        project:project,
    });
});

router.post('/create/:projectId/:storyId', TasksHelper.checkIfSMorMember, async function(req, res, next) {
    let data = req.body;
    let projectId = req.params.projectId;
    let projectUsers = await ProjectHelper.getProjectMembers(req.params.projectId);
    let taskStory    = await StoriesHelper.getStory(req.params.storyId);
    let storyTasksTimeSum = 0;
    let storyTasks   = await TasksHelper.listTasks(req.params.storyId);
    let project      = await ProjectHelper.getProject(req.params.projectId);

    for(var i = 0; i < storyTasks.length; i++){
        storyTasksTimeSum += storyTasks[i].time;
    }
    let available_time_for_new_task = (taskStory.estimatedTime - storyTasksTimeSum) > 0 ? taskStory.estimatedTime - storyTasksTimeSum : 0 ;

    let assignee = null;
    let status = 0;
    if (data.assignee) {
        assignee = data.assignee;
        status = 1;
    }

    try {
        // Create new task
        const createdTask = Tasks.build({
            name: data.name,
            description: data.description,
            time: data.time/6,
            assignee: assignee,
            status: status,
            story_id: req.params.storyId,
            project_id: projectId
        });

        // validate task
        if (!await TasksHelper.isValidTaskChange(createdTask)){
            req.flash('error', `Task name: ${createdTask.name} already in use`);
            res.render('add_edit_task', {
                errorMessages: req.flash('error'),
                success: 0,
                pageName: 'tasks',
                uid: req.user.id,
                username: req.user.username,
                isUser: req.user.is_user,
                projectId: req.params.projectId,
                storyId: req.params.storyId,
                projectUsers: projectUsers,
                toEditTask: false,
                timeForNewTask:available_time_for_new_task,
                project:project,
            });
            return;
        }

        await createdTask.save();

        req.flash('success', 'Task - ' + createdTask.name + ' has been successfully created');
        res.render('add_edit_task', {
            errorMessages: 0,
            success: req.flash('success'),
            pageName: 'tasks',
            uid: req.user.id,
            username: req.user.username,
            isUser: req.user.is_user,
            projectId: req.params.projectId,
            storyId: req.params.storyId,
            projectUsers: projectUsers,
            toEditTask: createdTask,
            timeForNewTask:available_time_for_new_task,
            project:project,
        });

    } catch (e) {
        console.log(e);
        req.flash('error', 'Error!');
        res.render('add_edit_task', {
            errorMessages: req.flash('error'),
            success: 0,
            pageName: 'tasks',
            uid: req.user.id,
            username: req.user.username,
            isUser: req.user.is_user,
            projectId: req.params.projectId,
            storyId: req.params.storyId,
            projectUsers: projectUsers,
            toEditTask: false,
            timeForNewTask:available_time_for_new_task,
            project:project,

        });

    }

});

//  ------------- edit a task ----------------
router.get('/:taskId/edit', TasksHelper.checkIfSMorMember, async function(req, res, next) {
    let currentTask  = await TasksHelper.getTask(req.params.taskId);
    let projectUsers = await ProjectHelper.getProjectMembers(currentTask.project_id);
    let project = await ProjectHelper.getProject(currentTask.project_id);
    let taskStory    = await StoriesHelper.getStory(currentTask.story_id);
    let storyTasksTimeSum = 0;
    let storyTasks   = await TasksHelper.listTasks(taskStory.id);
    for(var i = 0; i < storyTasks.length; i++){
        storyTasksTimeSum += storyTasks[i].time;
    }
    let available_time_for_new_task = (taskStory.estimatedTime - storyTasksTimeSum) > 0 ? (taskStory.estimatedTime - storyTasksTimeSum) : 0 ;

    res.render('add_edit_task', {
        errorMessages: 0,
        success: 0,
        pageName: 'tasks',
        uid: req.user.id,
        username: req.user.username,
        isUser: req.user.is_user,
        projectId: currentTask.project_id,
        storyId: currentTask.story_id,
        projectUsers: projectUsers,
        toEditTask: currentTask,
        timeForNewTask:available_time_for_new_task,
        project:project,


    });
});

router.post('/:taskId/edit/', TasksHelper.checkIfSMorMember, async function(req, res, next) {
    let data = req.body;
    let task_id = req.params.taskId;
    let task = await TasksHelper.getTask(req.params.taskId);
    let taskStory    = await StoriesHelper.getStory(task.story_id);
    let storyTasksTimeSum = 0;
    let storyTasks   = await TasksHelper.listTasks(taskStory.id);
    let project = await ProjectHelper.getProject(task.project_id);

    for(var i = 0; i < storyTasks.length; i++){
        storyTasksTimeSum += storyTasks[i].time;
    }
    let available_time_for_new_task = (taskStory.estimatedTime - storyTasksTimeSum) > 0 ? taskStory.estimatedTime - storyTasksTimeSum : 0 ;


    let projectUsers = await ProjectHelper.getProjectMembers(task.project_id);

    let assignee = task.assignee;
    let status = task.status;
    if (data.assignee === "") {
        assignee = null;
        status = 0;
    }
    else if (data.assignee !== task.assignee) {
        assignee = data.assignee;
        status = 1;
    }

    // Set new attributes
    task.setAttributes({
        name: data.name,
        description: data.description,
        time: data.time/6,
        assignee: assignee,
        status: status
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task name: ${task.name} already in use`);
        res.render('add_edit_task', {
            errorMessages: req.flash('error'), success: 0, pageName: 'tasks', uid: req.user.id, username: req.user.username,
            isUser: req.user.is_user, projectId: task.project_id, storyId: task.story_id, projectUsers: projectUsers, toEditTask: false,
            timeForNewTask:available_time_for_new_task,project:project,
        });
    }

    await task.save();

    let task_updated = await TasksHelper.getTask(task_id);

    req.flash('success', 'Task - ' + task_updated.name + ' has been successfully updated');
    res.render('add_edit_task', {
        errorMessages: 0,
        success: req.flash('success'),
        pageName: 'tasks',
        uid: req.user.id,
        username: req.user.username,
        isUser: req.user.is_user,
        projectId: task.project_id,
        storyId: task.story_id,
        projectUsers: projectUsers,
        toEditTask: task_updated,
        timeForNewTask:available_time_for_new_task,
        project:project,
    });

});

//  ------------- delete a task ----------------
router.get('/:taskId/delete', TasksHelper.checkIfSMorMember, async function(req, res, next) {
    let task_id = req.params.taskId;


    // we need this (so we can get project_id) to navigate back to project backlog
    let task = await Tasks.findOne({
        where: {
            id: task_id,
        }
    });

    let is_deleted = await TasksHelper.deleteTaskById(task_id);
    if (is_deleted) {
        return res.redirect('/projects/'+ task.project_id +'/view');
    }else{
        return res.status(500).send('Delete failed')
    }
});

//  ------------- accept a task ----------------
router.get('/:taskId/accept', middleware.ensureAuthenticated, async function(req, res, next) {
    let task_id = req.params.taskId;

    let task = await Tasks.findOne({
        where: {
            id: task_id
        }
    });

    if (task.status === 2 || task.assignee !== req.user.id) {
        req.flash('error', `Task ${task.name} has not been assigned to you.`);
        return;
    }

    task.setAttributes({
        status: 2
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task ${task.name} can not be accepted right now.`);
    }

    await task.save();

    //req.flash('success', 'Task - ' + task.name + ' has been accepted!');
    res.redirect('/');
});

//  ------------- reject a task ----------------
router.get('/:taskId/reject', middleware.ensureAuthenticated, async function(req, res, next) {
    let task_id = req.params.taskId;

    let task = await Tasks.findOne({
        where: {
            id: task_id
        }
    });


    if (task.assignee !== req.user.id) {
        req.flash('error', `Task ${task.name} has not been assigned to you.`);
        return;
    }

    task.setAttributes({
        status: 0,
        assignee: null
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task ${task.name} can not be rejected right now.`);
    }

    await task.save();

    //req.flash('success', 'Task - ' + task.name + ' has been rejected.');
    res.redirect('/');
});

//  ------------- TEMP: start a task ----------------
router.get('/:taskId/startTemp', middleware.ensureAuthenticated, async function(req, res, next) {
    let task_id = req.params.taskId;

    let task = await Tasks.findOne({
        where: {
            id: task_id
        }
    });

    if (task.assignee !== req.user.id) {
        req.flash('error', `Task ${task.name} has not been assigned to you.`);
        return;
    } else if (task.status === 3) {
        req.flash('error', `Task ${task.name} has already been started.`);
        return;
    }

    task.setAttributes({
        status: 3
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task ${task.name} can not be started right now.`);
    }

    await task.save();

    await startAutoTracking(task);

    //req.flash('success', 'Task - ' + task.name + ' has been finished.');
    res.redirect('/');
});

//  ------------- finish a task ----------------
router.get('/:taskId/finish', middleware.ensureAuthenticated, async function(req, res, next) {
    let task_id = req.params.taskId;

    let task = await Tasks.findOne({
        where: {
            id: task_id
        }
    });


    if (task.assignee !== req.user.id) {
        req.flash('error', `Task ${task.name} has not been assigned to you.`);
        return;
    } else if (task.status === 4) {
        req.flash('error', `Task ${task.name} has already been finished.`);
        return;
    }

    task.setAttributes({
        status: 4
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task ${task.name} can not be finished right now.`);
    }

    await task.save();

    await stopAutoTracking(task);

    //req.flash('success', 'Task - ' + task.name + ' has been finished.');
    res.redirect('/');
});

//  ------------- finish a task ----------------
router.get('/:taskId/pause', middleware.ensureAuthenticated, async function(req, res, next) {
    let task_id = req.params.taskId;

    let task = await Tasks.findOne({
        where: {
            id: task_id
        }
    });


    if (task.assignee !== req.user.id) {
        req.flash('error', `Task ${task.name} has not been assigned to you.`);
        return;
    } else if (task.status === 2) {
        req.flash('error', `Task ${task.name} has already been paused.`);
        return;
    }

    task.setAttributes({
        status: 2
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task ${task.name} can not be paused right now.`);
    }

    await task.save();

    await stopAutoTracking(task);

    //req.flash('success', 'Task - ' + task.name + ' has been finished.');
    res.redirect('/');
});

//  ------------- restart a task ----------------
router.get('/:taskId/restart', middleware.ensureAuthenticated, async function(req, res, next) {
    let task_id = req.params.taskId;

    let task = await Tasks.findOne({
        where: {
            id: task_id
        }
    });

    if (task.assignee !== req.user.id) {
        req.flash('error', `Task ${task.name} has not been assigned to you.`);
        return;
    } else if (task.status !== 4) {
        req.flash('error', `Task ${task.name} has not been finished yet.`);
        return;
    }

    task.setAttributes({
        status: 3
    });

    // validate task
    if (!await TasksHelper.isValidTaskChange(task)){
        req.flash('error', `Task ${task.name} can not be restarted right now.`);
    }

    await task.save();

    await startAutoTracking(task);

    //req.flash('success', 'Task - ' + task.name + ' has been finished.');
    res.redirect('/');
});

let startAutoTracking = async function(task){
    // Create new timetable
    const createdTimetable = Timetable.build({
        remainingTime: task.time,
        loggedTime: 0,
        loggedDate: new Date(),
        autoLoggedDate: new Date(),
        task_id: task.id,
        loggedUser: task.assignee
    });

    await createdTimetable.save();
    console.log("Auto tracker for task ID " + task.id + " started.");
};

let stopAutoTracking = async function(task){

    let timetableArray = await Timetable.findAll({
        where: {
            task_id: task.id
        },
        order: [
            ['id', 'DESC']
        ],
    });

    var timetable = timetableArray[timetableArray.length - 1]; // get last
    var startDate = timetable.loggedDate;
    var endDate = new Date();
    var timeDifferenceMS = endDate - startDate;
    var timeDifferenceHours = (timeDifferenceMS / 1000) / 3600;
    if (timeDifferenceHours < 0.016) {
        // manj kot minuta, damo na 1 minuto
        timeDifferenceHours = 1 / 60;
    }

    timeDifferenceHours = timeDifferenceHours / 6; // shranimo v točkah

    timetable.setAttributes({
        remainingTime: task.time,
        loggedTime: timeDifferenceHours,
        loggedDate: endDate,
        loggedUser: task.assignee
    });

    await timetable.save();

    var loggedTime = await TasksHelper.getTaskLoggedTime(task);
    task.setAttributes({
        loggedTime: loggedTime
    });
    await task.save();

    console.log("Auto tracker for task ID " + task.id + " stopped.");
};
module.exports = router;
