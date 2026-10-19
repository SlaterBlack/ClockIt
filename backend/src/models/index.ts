import { User } from './User';
import { Workspace } from './Workspace';
import { Project } from './Project';
import { TimeEntry } from './TimeEntry';
import { Task } from './Task';

// User <-> Workspace (a user owns many workspaces)
User.hasMany(Workspace, { foreignKey: 'ownerId', as: 'workspaces' });
Workspace.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

// Workspace <-> Project
Workspace.hasMany(Project, { foreignKey: 'workspaceId', as: 'projects' });
Project.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });

// User <-> TimeEntry
User.hasMany(TimeEntry, { foreignKey: 'userId', as: 'timeEntries' });
TimeEntry.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Project <-> TimeEntry
Project.hasMany(TimeEntry, { foreignKey: 'projectId', as: 'timeEntries' });
TimeEntry.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Project <-> Task
Project.hasMany(Task, { foreignKey: 'projectId', as: 'tasks' });
Task.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Task <-> TimeEntry (taskId stays nullable for entries created before task assignment was required)
Task.hasMany(TimeEntry, { foreignKey: 'taskId', as: 'timeEntries', onDelete: 'RESTRICT' });
TimeEntry.belongsTo(Task, { foreignKey: 'taskId', as: 'task' });

export { User, Workspace, Project, Task, TimeEntry };
