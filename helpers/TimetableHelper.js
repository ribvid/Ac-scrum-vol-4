const models = require('../models');

const Tasks = models.Tasks;
const User = models.User;
const Timetable = models.Timetable;

var sequelize = require('sequelize');
const ProjectHelper = require('../helpers/ProjectHelper');
const StoriesHelper = require('../helpers/StoriesHelper');
const SprintsHelper = require('../helpers/SprintsHelper');

var moment = require('moment');

async function listTimeLogs(userId, taskId) {
    return await Timetable.findAll({
        include: [
            {
                model: models.Tasks,
                as: 'Task',
                include: [
                    {
                        model: models.Stories,
                        as: 'Story',
                        attributes: ['name', 'sprint_id'],
                        include: [
                            {
                                model: models.Sprint,
                                as: 'Sprint',
                                attributes: ['startDate', 'endDate'],
                                include: [
                                    {
                                        model: models.Project,
                                        as: 'Project',
                                        attributes: ['name']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        where: {
            loggedUser: userId,
            task_id: taskId
        }
    });
}

async function listTimeLogsAll(userId) {
    return await Timetable.findAll({
        include: [
            {
                model: models.Tasks,
                as: 'Task',
                include: [
                    {
                        model: models.Stories,
                        as: 'Story',
                        attributes: ['name', 'sprint_id'],
                        include: [
                            {
                                model: models.Sprint,
                                as: 'Sprint',
                                attributes: ['startDate', 'endDate'],
                                include: [
                                    {
                                        model: models.Project,
                                        as: 'Project',
                                        attributes: ['name']
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        where: {
            loggedUser: userId
        }
    });
}

async function getLogToEdit(logId) {
    return await Timetable.findOne({
        where: {
            id: logId,
        }
    });
}

async function deleteLogById(logId) {
    try {
        // !! - return true if successful, else false
        return !!await Timetable.destroy({
            where: {
                id: logId
            },
            force: true,
        });
    } catch (e) {
        console.log("Can't delete " + e);
        return false;
    }
}


module.exports = {
    listTimeLogs,
    listTimeLogsAll,
    getLogToEdit,
    deleteLogById
};