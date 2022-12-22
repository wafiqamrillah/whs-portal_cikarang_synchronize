const { Sequelize, DataTypes, Model } = require('sequelize');
const { join } = require('path');
const environment = require(join(__dirname, '../../env.json'));
const sequelize = new Sequelize(environment.PORTAL_DB_NAME, environment.PORTAL_DB_USER, environment.PORTAL_DB_PASS, {
    host: environment.PORTAL_DB_HOST,
    port: environment.PORTAL_DB_PORT,
    dialect: environment.PORTAL_DB_DRIVER,
    logging: false
});

const DeliveryNote = sequelize.define('DeliveryNote');

class DeliveryNoteLine extends Model {}

DeliveryNoteLine.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        abas_id: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        part_abas_id: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        part_number: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        part_name: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        part_desc: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        job_number: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        delivery_qty: {
            type: DataTypes.DECIMAL(),
            allowNull: true,
            defaultValue: 0,
        },
        status: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        abas_status: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'DeliveryNoteLine',
        tableName: 'delivery_note_lines',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
);

DeliveryNoteLine.belongsTo(
    DeliveryNote,
    {
        foreignKey: 'delivery_note_id',
        as: 'DeliveryNote',
    }
);

module.exports = DeliveryNoteLine;