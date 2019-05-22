var express = require('express');
var router = express.Router();
var moment = require('moment');
var showdown = require('showdown');

var models = require('../models/');
var middleware = require('./middleware.js');

// models
var User = models.User;
var Projects = models.Project;
var UserProject = models.UserProject;
var Documentation = models.Documentation;

// helpers
var ProjectHelper = require('../helpers/ProjectHelper');
var StoriesHelper = require('../helpers/StoriesHelper');
var SprintsHelper = require('../helpers/SprintsHelper');
var TasksHelper   = require('../helpers/TasksHelper');

// ------------------ This should list all projects that are available to signed user ------------------
router.get('/', middleware.ensureAuthenticated, async function(req, res, next) {
    // let userProjects = await ProjectHelper.listUserProjects();
    let projects = await ProjectHelper.getAllowedProjects(req.user.id);

    res.render('projects', { errorMessages: 0, success: 0, pageName: 'projects', projects: projects, username: req.user.username, isUser: req.user.is_user, uid:req.user.id});
});

// ------------------ endpoint for project page ------------------
router.get('/:id/view', ProjectHelper.canAccessProject, async function(req, res, next) {
    let currentProject = await ProjectHelper.getProject(req.params.id);
    let projectStories = await StoriesHelper.listStories(req.params.id);
    let activeSprintId = await SprintsHelper.currentActiveSprint(currentProject.id);
    let projectTasks   = await TasksHelper.listProjectTasks(req.params.id);

    for (var i = 0; i < projectTasks.length; i++) {
        var assignee = projectTasks[i].assignee;
        if (assignee !== null) {
            projectTasks[i].assigneeTask = (await User.findById(projectTasks[i].assignee)).name;
        }
        else {
            projectTasks[i].assigneeTask = false;
        }
    }

    for (let i = 0; i < projectStories.length; i++) {
        if(projectStories[i].dataValues.sprint_id != null){
            let story_sprint = await SprintsHelper.getSprint(projectStories[i].dataValues.sprint_id);
            story_sprint.dataValues.startDate = moment(story_sprint.dataValues.startDate,'YYYY-MM-DD').format("DD.MM.YYYY");
            story_sprint.dataValues.endDate   = moment(story_sprint.dataValues.endDate,'YYYY-MM-DD').format("DD.MM.YYYY");
            projectStories[i].sprint = story_sprint;
        }
    }
    
    res.render('project', { errorMessages: 0, success: 0, pageName: 'projects', project: currentProject,
        stories: projectStories, tasks: projectTasks, uid: req.user.id, username: req.user.username,
        isClickable: req.user.name === currentProject.ProductOwner.name || req.user.name === currentProject.ScrumMaster.name,
        isUser: req.user.is_user,
    activeSprintId:activeSprintId});
});

// ------------------ endpoint for editing existing projects ------------------
router.get('/:id/edit/', ProjectHelper.isSMorAdmin, async function(req, res, next) {

    let toEditProject = await ProjectHelper.getProjectToEdit(req.params.id);
    let users = await User.findAllUsers();
    res.render('add_edit_project', { errorMessages: 0, title: 'AC scrum vol2', users: users,
        pageName: 'projects', username: req.user.username, toEditProject: toEditProject,
        isUser: req.user.is_user, success: 0 });
});

router.post('/:id/edit/', ProjectHelper.isSMorAdmin, async function(req, res, next) {
    var data = req.body;

    let users = await User.findAllUsers();
    // Get current version
    var project = await Projects.findOne({
        where: {
            id:req.params.id,
        }
    });

    // Set new attributes
    project.setAttributes({
        name: data.name,
        description: data.description,
        created_by: req.user.id,
        scrum_master: data.scrum_master,
        product_owner: data.product_owner,
    });

    // validate project
    if (!await ProjectHelper.isValidProject(project)){
        let toEditProject = await ProjectHelper.getProjectToEdit(project.id);
        req.flash('error', `Project Name: ${project.name} already in use!`);
        res.render('add_edit_project', { errorMessages: req.flash('error'), users:users, success: 0,
            title: 'AC scrum vol2', pageName: 'projects', toEditProject:toEditProject,
            username: req.user.username, isUser: req.user.is_user });
        return;
    }

    await project.save();

    // Destroy all current members
    await UserProject.destroy({
        where: {
            project_id: project.id,
        },
        force:true,
    });

    await ProjectHelper.saveProjectMembers(project, data.members);

    let toEditProject = await ProjectHelper.getProjectToEdit(req.params.id);

    req.flash('success', 'Project: '+ project.name + ' has been successfully updated');
    return res.render('add_edit_project', { errorMessages: 0, title: 'AC scrum vol2', users: users,
        pageName: 'projects', username: req.user.username, toEditProject: toEditProject,
        isUser: req.user.is_user, success: req.flash('success') });
});

// ------------------ endpoint for creating new projects ------------------

/**
 * Only admin can add new projects:
 *
 */
router.get('/create/', middleware.isAllowed, async function(req, res, next) {
    let users = await User.findAllUsers();
    res.render('add_edit_project', { errorMessages: 0, title: 'AC scrum vol2', users: users,
        pageName: 'projects', username: req.user.username,
        isUser: req.user.is_user, success: 0 });
});

router.post('/create/', middleware.isAllowed, async function(req, res, next) {

    let data = req.body;

    try {

        let users = await User.findAllUsers();

        // Create new project
        const createdProject = Projects.build({
            name: data.name,
            description: data.description,
            created_by: req.user.id,
            scrum_master: data.scrum_master,
            product_owner: data.product_owner,
        });

        // Validate project
        if (!await ProjectHelper.isValidProject(createdProject)){
            req.flash(req.flash('error', `Project Name: ${createdProject.name} already in use!`));
            return res.render('add_edit_project', { errorMessages: req.flash('error'),users:users, success: 0,
                title: 'AC scrum vol2', pageName: 'projects',
                username: req.user.username, isUser: req.user.is_user });
        }

        await createdProject.save();

        await ProjectHelper.saveProjectMembers(createdProject, data.members);

        req.flash('success', 'New Projects - ' + createdProject.name + ' has been successfully added');
        res.render('add_edit_project', { success: req.flash('success'),users:users, errorMessages: 0,
            title: 'AC scrum vol2', pageName: 'projects',
            username: req.user.username, isUser: req.user.is_user });
    } catch (e) {
        req.flash('error', 'Error!');
        res.render('add_edit_project', { errorMessages: req.flash('error'),users:[], success: 0,
            title: 'AC scrum vol2', pageName: 'projects',
            username: req.user.username, isUser: req.user.is_user });

    }

});

// ------------------ endpoints for documentation ------------------

router.get('/:id/documentation', ProjectHelper.canAccessProject, async function(req, res, next) {
	const currentProject = await ProjectHelper.getProject(req.params.id);
	const documentation = await ProjectHelper.getProjectDocumentation(req.params.id);

	if (!!documentation && !!documentation.content) {
	    const converter = new showdown.Converter();
		documentation.content = converter.makeHtml(documentation.content);
	}

	const success = req.query.status === "success" ? req.flash('success') : 0;

	res.render('documentation', {
	    pageName: 'documentation',
        project: currentProject,
        documentation: documentation,
		success: success.length > 0 ? success : 0,
		uid: req.user.id,
		username: req.user.username,
		isUser: req.user.is_user,
	});
});

router.get('/:id/documentation/create', ProjectHelper.canAccessProject, async function(req, res, next) {
	const documentation = await ProjectHelper.getProjectDocumentation(req.params.id);

	if (!!documentation && documentation.content) {
		return res.redirect('/projects/' + req.params.id + '/documentation/edit');
	}

	const currentProject = await ProjectHelper.getProject(req.params.id);

    res.render('add_edit_documentation', {
        pageName: 'create_documentation',
		errorMessages: 0,
		project: currentProject,
		uid: req.user.id,
		username: req.user.username,
		isUser: req.user.is_user,
	});
});

router.post('/:id/documentation/create', ProjectHelper.canAccessProject, async function(req, res, next) {
	const documentation = await ProjectHelper.getProjectDocumentation(req.params.id);

	if (!!documentation && documentation.content) {
		return res.redirect('/projects/' + req.params.id + '/documentation/edit');
	}

	const currentProject = await ProjectHelper.getProject(req.params.id);
	const data = req.body;

	try {
	    const content = data.content;

	    if (!content) {
	        req.flash('error', 'Content is missing!');
			return res.render('add_edit_documentation', {
				pageName: 'create_documentation',
				errorMessages: req.flash('error'),
				project: currentProject,
				uid: req.user.id,
				username: req.user.username,
				isUser: req.user.is_user,
			});
        }

		// Create new documentation
		const createdDocumentation = Documentation.build({
			content: content,
			project_id: currentProject.id
		});

		await createdDocumentation.save();

		req.flash('success', 'Documentation for ' + currentProject.name + ' has been successfully created');

		return res.redirect('/projects/' + currentProject.id + '/documentation?status=success');

    } catch (e) {
		req.flash('error', 'Error!');
		console.log(e);
		return res.render('add_edit_documentation', {
			pageName: 'create_documentation',
			errorMessages: req.flash('error'),
			project: currentProject,
			uid: req.user.id,
			username: req.user.username,
			isUser: req.user.is_user,
		});
	}
});

router.get('/:id/documentation/edit', ProjectHelper.canAccessProject, async function(req, res, next) {
	const documentation = await ProjectHelper.getProjectDocumentation(req.params.id);

	if (!documentation || !documentation.content) {
		return res.redirect('/projects/' + req.params.id + '/documentation/create');
	}

	const currentProject = await ProjectHelper.getProject(req.params.id);

	res.render('add_edit_documentation', {
        pageName: 'create_documentation',
		errorMessages: 0,
		project: currentProject,
		documentation: documentation,
		uid: req.user.id,
		username: req.user.username,
		isUser: req.user.is_user,
	});
});

router.post('/:id/documentation/edit', ProjectHelper.canAccessProject, async function(req, res, next) {
	const documentation = await ProjectHelper.getProjectDocumentation(req.params.id);

	if (!documentation || !documentation.content) {
		return res.redirect('/projects/' + req.params.id + '/documentation/create');
	}

	const currentProject = await ProjectHelper.getProject(req.params.id);
	const data = req.body;

	try {
	    const content = data.content;

	    if (!content) {
	        req.flash('error', 'You can\'t save documentation with no content!');
			return res.render('add_edit_documentation', {
				pageName: 'create_documentation',
				errorMessages: req.flash('error'),
				project: currentProject,
				documentation: documentation,
				uid: req.user.id,
				username: req.user.username,
				isUser: req.user.is_user,
			});
        }

		documentation.setAttributes({
			content: content,
		});

		await documentation.save();

		req.flash('success', 'Documentation for ' + currentProject.name + ' has been successfully updated');

		return res.redirect('/projects/' + currentProject.id + '/documentation?status=success');

    } catch (e) {
		req.flash('error', 'Error!');
		console.log(e);
		return res.render('add_edit_documentation', {
			pageName: 'create_documentation',
			errorMessages: req.flash('error'),
			project: currentProject,
			uid: req.user.id,
			username: req.user.username,
			isUser: req.user.is_user,
		});
	}
});

router.post('/:id/documentation/import', ProjectHelper.canAccessProject, async function(req, res, next) {
	const documentation = await ProjectHelper.getProjectDocumentation(req.params.id);

	if (!!documentation && documentation.content) {
		return res.redirect('/projects/' + req.params.id + '/documentation/edit');
	}

	const currentProject = await ProjectHelper.getProject(req.params.id);

	const importedFile = req.files.importedDocumentation;

	if (!(new RegExp('(' + [".md", ".txt"].join('|').replace(/\./g, '\\.') + ')$')).test(importedFile.name)) {
		req.flash('error', 'Only .txt and .md files are supported!');
		return res.render('import_documentation', {
			pageName: 'import_documentation',
			project: currentProject,
			errorMessages: req.flash('error'),
			uid: req.user.id,
			username: req.user.username,
			isUser: req.user.is_user,
		});
	}

	try {
		const buffer = Buffer.from(importedFile.data);
		const content = buffer.toString();
		const createdDocumentation = Documentation.build({
			content: content,
			project_id: currentProject.id
		});

		await createdDocumentation.save();

		req.flash('success', 'Documentation for ' + currentProject.name + ' has been successfully created');

		return res.redirect('/projects/' + currentProject.id + '/documentation?status=success');

	} catch (e) {
		req.flash('error', 'Error!');
		console.log(e);
		return res.render('import_documentation', {
			pageName: 'import_documentation',
			project: currentProject,
			errorMessages: 0,
			uid: req.user.id,
			username: req.user.username,
			isUser: req.user.is_user,
		});
	}
});

module.exports = router;