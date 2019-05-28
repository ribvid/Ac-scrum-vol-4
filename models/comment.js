'use strict';
module.exports = (sequelize, DataTypes) => {
    var Comment = sequelize.define('Comment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        id_user: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            field: 'createdat',
            type: DataTypes.DATE,
        },
        updatedAt: {
            field: 'updatedat',
            type: DataTypes.DATE,
        }
        /*,
        test_bit:{
            type: DataTypes.INTEGER
        }*/
    });

    Comment.associate = function (models) {
        models.Comment.belongsTo(models.Project, {
            onDelete: "CASCADE",
            foreignKey: 'project_id',
            as: 'Project'
        });
    };

    return Comment;
};