'use strict';
module.exports = (sequelize, DataTypes) => {
    var Timetable = sequelize.define('Timetable', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        remainingTime: {
            type: DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: {
                    args: [0.0],
                    msg: 'Cant be a negative value.'
                }
            }
        },
        loggedTime: {
            type: DataTypes.FLOAT,
            allowNull: false,
            validate: {
                min: {
                    args: [0.0],
                    msg: 'Cant be a negative value.'
                }
            }
        },
        loggedDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        autoLoggedDate: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        createdAt: {
            field: 'createdat',
            type: DataTypes.DATE,
        },
        updatedAt: {
            field: 'updatedat',
            type: DataTypes.DATE,
        },
    });

    Timetable.associate = function (models) {
        models.Timetable.belongsTo(models.Tasks, {
            onDelete: "CASCADE",
            foreignKey: 'task_id',
            as: 'Task'
        });
        models.Timetable.belongsTo(models.User, {
            onDelete: "CASCADE",
            foreignKey: 'loggedUser',
            as: 'LoggedUser'
        });
    };

    return Timetable;
};