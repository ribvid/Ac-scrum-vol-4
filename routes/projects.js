var express = require('express');
var router = express.Router();
var moment = require('moment');
var showdown = require('showdown');
var fs = require('fs');
var http = require('http');

var models = require('../models/');
var middleware = require('./middleware.js');

// models
var User = models.User;
var Projects = models.Project;
var UserProject = models.UserProject;
var Documentation = models.Documentation;
var CommentModel = models.Comment;

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

// ------ Wall

router.get('/:id/wall', ProjectHelper.canAccessProject, async function(req, res, next) {
	const currentProject = await ProjectHelper.getProject(req.params.id);
    const comments = await ProjectHelper.getProjectWall(req.params.id);
    //console.log(comments);
    //console.log("--------------");
    //const comments = "";
    /**
	if (!!documentation && !!documentation.content) {
	    const converter = new showdown.Converter();
		documentation.content = converter.makeHtml(documentation.content);
    }
    */
    const converter = new showdown.Converter();
    var i;
    for(i = 0; i < comments.length; i++){
        comments[i].dataValues.content = converter.makeHtml(comments[i].dataValues.content);
    }
	res.render('wall', {
	    pageName: 'wall',
        project: currentProject,
        comments: comments,
		success: req.query.status === "success" ? req.flash('success') : 0,
		uid: req.user.id,
		username: req.user.username,
		isUser: req.user.is_user,
	});
});

router.post('/:id/wall/:uid', ProjectHelper.canAccessProject, async function(req, res, next) {
    const currentProject = req.params.id;
    const currentUser = req.params.uid;
    const currentUserUsername = req.user.username;
    const currentUserName = req.user.name;
    const currentUserSurname = req.user.surname;

    const user = currentUserName + ' ' + currentUserSurname + ' (' + currentUserUsername + ')';
    let comment = req.body.input_comment;
    let date = moment(new Date()).format("YYYY-MM-DD HH:mm:ss");

    //Prazen komentar
    if(comment.length == 0){
        res.render('wall', {
            pageName: 'wall',
            project: currentProject,
            comments: comments,
            success: "error",
            uid: req.user.id,
            username: req.user.username,
            isUser: req.user.is_user,
        });  
    }

    //-> pretvorba v markdown
    const comments = await ProjectHelper.getProjectWall(req.params.id);
    const converter = new showdown.Converter();
    var i;
    for(i = 0; i < comments.length; i++){
        comments[i].dataValues.content = converter.makeHtml(comments[i].dataValues.content);
    }
    

    //Dodaj v bazo vse zgoraj
    try {

		// Create new documentation
		const createdComment = CommentModel.build({
            username: user,
            id_user: currentUser,
            content: comment,
            createdat: date,
            updatedat: date,
			project_id: currentProject,
		});

		await createdComment.save();

		req.flash('success', 'Comment has been successfully created');

		return res.redirect('/projects/' + currentProject + '/wall?status=success');

    } catch (e) {
		req.flash('error', 'Error!');
		console.log(e);
		return res.render('wall', {
			pageName: 'wall',
			errorMessages: req.flash('error'),
			project: currentProject,
            comments: comments,
            success: "exception",
            uid: req.user.id,
            username: req.user.username,
            isUser: req.user.is_user,
		});
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

	const error = req.query.status === "error" ? req.flash('error') : 0;

	res.render('documentation', {
	    pageName: 'documentation',
        project: currentProject,
        documentation: documentation,
		errorMessages: error.length > 0 ? error : 0,
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
		req.flash('error', 'Import has failed! Only .txt and .md files can be imported!');
		return res.redirect('/projects/' + currentProject.id + '/documentation?status=error');
	}

	try {
		const buffer = Buffer.from(importedFile.data);
		const content = buffer.toString();
		const createdDocumentation = Documentation.build({
			content: content,
			project_id: currentProject.id
		});

		await createdDocumentation.save();

		req.flash('success', 'Documentation for ' + currentProject.name + ' has been successfully imported');

		return res.redirect('/projects/' + currentProject.id + '/documentation?status=success');

	} catch (e) {
		req.flash('error', 'Import has failed!');
		console.log(e);
		return res.redirect('/projects/' + currentProject.id + '/documentation?status=error');
	}
});

router.get('/:id/documentation/export', ProjectHelper.canAccessProject, async function(req, res, next) {
	const projectId = req.params.id;
	const documentation = await ProjectHelper.getProjectDocumentation(projectId);

	if (!documentation || !documentation.content) {
		req.flash('error', 'Can\'t export documentation because it does not exist.');
		return res.redirect('/projects/' + projectId + '/documentation?status=error');
	}
	
	const filename = `documentation-${projectId}.md`;

	fs.writeFile(`public/documentations/${filename}`, documentation.content, function (err) {
		if (err) {
			req.flash('error', 'Export has failed!');
			console.log(err);
			return res.redirect('/projects/' + projectId + '/documentation?status=error');
		}

		res.download(`public/documentations/${filename}`);
	});
});

module.exports = router;