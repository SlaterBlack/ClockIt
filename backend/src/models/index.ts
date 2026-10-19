import { User } from './User';
import { Workspace } from './Workspace';
import { Project } from './Project';
import { TimeEntry } from './TimeEntry';

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

export { User, Workspace, Project, TimeEntry };
