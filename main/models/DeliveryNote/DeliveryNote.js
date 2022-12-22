const { Sequelize, DataTypes, Model } = require('sequelize');
const { join } = require('path');
const environment = require(join(__dirname, '../../env.json'));
const sequelize = new Sequelize(environment.PORTAL_DB_NAME, environment.PORTAL_DB_USER, environment.PORTAL_DB_PASS, {
    host: environment.PORTAL_DB_HOST,
    port: environment.PORTAL_DB_PORT,
    dialect: environment.PORTAL_DB_DRIVER,
    logging: false
});

const DeliveryOrder = require('./DeliveryOrder');
const DeliveryNoteLine = require('./DeliveryNoteLine');

class DeliveryNote extends Model {}

DeliveryNote.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        order_number: {
            type: DataTypes.STRING(191),
        },
        purchase_order_number: {
            type: DataTypes.STRING(191),
        },
        reference: {
            type: DataTypes.STRING(191),
        },
        sales_order_number: {
            type: DataTypes.STRING(191),
        },
        abas_number: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        abas_id: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        operator: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        delivery_date: {
            type: DataTypes.DATEONLY(),
        },
        delivery_time: {
            type: DataTypes.TIME(),
        },
        no_polisi_kendaraan: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        nama_supir: {
            type: DataTypes.STRING(191),
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        abas_status: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        abas_print_status: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: 'DeliveryNote',
        tableName: 'delivery_notes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
);

DeliveryNote.belongsTo(
    DeliveryOrder,
    {
        foreignKey: 'delivery_order_id',
        as: 'DeliveryOrder',
    }
);

DeliveryNote.hasMany(
    DeliveryNoteLine,
    {
        foreignKey: 'delivery_note_id',
        as: 'DeliveryNoteLines',
    }
);

module.exports = DeliveryNote;