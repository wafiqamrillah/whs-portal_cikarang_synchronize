// Native
const { join } = require('path');

// Packages
const winax = require('winax');
const environment = require(join(__dirname, '../../env.json'));

// Modules
const workOrder = require('./workorder');

function ABAS_Connection() {
    const interval = setInterval(() => {
        winax.peekAndDispatchMessages();
    }, 50);

    const Host = environment.ABAS_HOST ?? "192.168.10.2";
    const Port = environment.ABAS_PORT ?? "6550";
    const Mandant = environment.ABAS_MANDANT ?? "erp2";
    const Passwort = environment.ABAS_PASSWORT_CKR ?? "ayam2011";

    const connection = new winax.Object('EDPActiveX.EDP', {
        activate: true,
        async: true,
        type: true
    });
    connection.AppName = environment.ABAS_APP_NAME ?? "Synchronize";
    connection.ClientEDPVersion = environment.ABAS_CLIENT_EDP_VERSION ?? "3.08";

    const connect = () => {
        try {
            if (typeof connection == "undefined") throw new Error("ABAS Connection not initiated.");
    
            console.log(`Trying connecting to ABAS session...`, {
                'Host' : Host,
                'Port' : Port,
                'Mandant' : Mandant,
                'Passwort' : Passwort
            });

            if (!connection.BeginSession(Host, Port, Mandant, Passwort)) throw new Error("ABAS cannot be connected.");

            return true;
        } catch (error) {
            throw error;
        }
    }

    const isConnected = () => connection.IsConnected();

    const endSession = () => connection.EndSession();

    return {
        connect,
        endSession,
        isConnected,
        connection,
        modules : {
            workOrder
        }
    }    
}

module.exports = ABAS_Connection();