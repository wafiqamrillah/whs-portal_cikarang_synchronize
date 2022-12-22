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

class DeliveryOrder extends Model {}

DeliveryOrder.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        number: {
            type: DataTypes.STRING(191)
        },
        file_name: {
            type: DataTypes.STRING(191)
        },
        status: {
            type: DataTypes.STRING(10)
        },
    },
    {
        sequelize,
        modelName: 'DeliveryOrder',
        tableName: 'delivery_orders',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
);

DeliveryOrder.hasMany(
    DeliveryNote,
    {
        foreignKey: 'delivery_order_id',
        as: 'DeliveryNotes',
    }
);

module.exports = DeliveryOrder;