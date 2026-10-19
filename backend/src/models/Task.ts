import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export interface TaskAttributes {
  id: string;
  name: string;
  projectId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TaskCreationAttributes = Optional<TaskAttributes, 'id'>;

export class Task extends Model<TaskAttributes, TaskCreationAttributes> implements TaskAttributes {
  public id!: string;
  public name!: string;
  public projectId!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Task.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'tasks',
    timestamps: true,
  },
);
