// Process
process.on('close', () => {
  handleMessage("Closing delivery note synchronize...");
  process.stop();
});
  
process.on('error', error => {
  console.log('error', error);
});

// Native
const { join } = require('path');

// Packages
const environment = require(join(__dirname, '../env.json'));
const abas = require(join(__dirname, '../app/abas'));
const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize(environment.PORTAL_DB_NAME, environment.PORTAL_DB_USER, environment.PORTAL_DB_PASS, {
    host: environment.PORTAL_DB_HOST,
    port: environment.PORTAL_DB_PORT,
    dialect: environment.PORTAL_DB_DRIVER,
    logging: false
});
const DeliveryNote = require(join(__dirname, '../models/DeliveryNote/DeliveryNote'));

// Variables
const Timer = (fn, t) => {
  let timerObject = null;

  let status = timerObject ? true : false;

  const setStatus = () => {
    status = getStatus();

    return "Status updated.";
  }

  const getStatus = () => {
    return timerObject ? true : false;
  }

  const stop = () => {
    if (timerObject) {
      clearInterval(timerObject);
      timerObject = null;
      setStatus();
    }
    return Timer;
  }

  const start = () => {
    if (!timerObject) {
      stop();
      timerObject = setInterval(fn, t);
      setStatus();
    }
    return Timer;
  }

  const reset = (newT = t) => {
    t = newT;
    return stop().start();
  }

  return {
    status,
    stop,
    start,
    reset,
    getStatus
  };
}

let synchronizeWatcher = null;

const handleMessage = (message, sendNotification = false) => {
  process.send({
    type: 'message',
    param: message
  });

  if (sendNotification) process.send({ type: 'notification', param: message });
}

const avoidTerminate = (value = true) => {
  process.send({
    type: 'setEnable',
    param: !value
  });
}

const handleError = (error, exit = true) => {
  console.log(error.message);

  handleMessage(error.message);

  if(exit) {
    if (synchronizeWatcher) clearInterval(synchronizeWatcher);
    process.exit();
  }
}

// Process
(
  async () => {
    try {
      avoidTerminate(true);
      handleMessage("Checking WHS-Portal database connection...");
      await sequelize.authenticate();

      handleMessage("WHS-Portal database connected.", true);

      setTimeout(() => {
        try {
          handleMessage("Checking ABAS connection...");
          abas.connect();
          handleMessage("ABAS connected.", true);

          avoidTerminate(false);
        
          const synchronizeTask = async() => {
            const connection = abas.connection;
  
            const synchronizeProcess = async() => {
              const datas = await DeliveryNote.findAll({
                where : {
                  sales_order_number : {
                    [Op.or]: {
                      [Op.eq]: '',
                      [Op.is]: null
                    }
                  },
                  status : 'ready',
                  abas_status :  {
                    [Op.or]: {
                      [Op.eq]: '',
                      [Op.is]: null
                    }
                  },
                },
                include: 'DeliveryNoteLines'
              });
                  
              if (datas.length > 0) {
                avoidTerminate(true);
                const total_data = datas.length;

                handleMessage(`Processing started. Total data : ${total_data}`, true);
          
                for (const [index, data] of datas.entries()) {
                  try {
                    data.status = 'check_so';
                    await data.save();

                    handleMessage(`Checking sales order data for delivery note ${data.order_number} with purchase order number ${data.purchase_order_number}... (${index + 1}/${total_data})`);
                    const result_check_sales_order = checkSalesOrder(data, index, total_data);

                    handleMessage(`Saving progress status for delivery note ${data.order_number} with purchase order number ${data.purchase_order_number}... (${index + 1}/${total_data})`);
                    result_check_sales_order.status = 'progress';
                    result_check_sales_order.abas_status = null;
                    await result_check_sales_order.save();
                    for (const [line_index, line] of result_check_sales_order.lines.entries()) {
                      line.status = "success";
                      line.abas_status = null;

                      await line.save();
                    }

                    handleMessage(`Saving successful status for delivery note ${data.order_number} with purchase order number ${data.purchase_order_number}... (${index + 1}/${total_data})`);
                    const result = createDeliveryNote(data, result_check_sales_order.lines);
                    result.status = 'success'; 
                    result.abas_status = 'success';
                    await result.save();
                    for (const [line_index, line] of result_check_sales_order.lines.entries()) {
                      line.status = "success";
                      line.abas_status = "success";

                      await line.save();
                    }
                  } catch (error) {
                    data.status = 'failed';
                    await data.save();     
                    for (const [line_index, line] of result_check_sales_order.lines.entries()) {
                      line.status = "failed";

                      await line.save();
                    }                 
                  }
                }

                avoidTerminate(false);
                handleMessage(`Data has been processed.`, true);
              }
            
              return `Finished at ${new Date()}`;
            }
            
            const checkSalesOrder = (data, index, total_data) => {
              try {
                let query = connection.CreateQuery();

                // Search Sales Order Number by Data Purchase Order Number
                if (!query.StartQuery("Sales:Sales order", "nummer", `abschlnr=${data.purchase_order_number}`)) throw new Error(`Cannot start query for delivery note ${data.order_number}. Error : ${query.GetLastError()}`);

                handleMessage(`Started query for delivery note : ${data.order_number}... (${index + 1}/${total_data})`);

                let results = [];
                let total_sales_order = 0;
                
                // Get sales order number
                while (query.GetNextRecord()) {
                  total_sales_order++;
                  handleMessage(`Getting sales order data number for delivery note : ${data.order_number}. Total sales order : (${total_sales_order}/${query.GetRecordCount()})... (${index + 1}/${total_data})`);
                  
                  results.push(query.GetFieldN('nummer'));
                }

                // Check if there is any sales order number
                if (results.length === 0) throw new Error(`There is no data for delivery note ${data.order_number}... (${index + 1}/${total_data})`);
                
                // Get first sales order numbers
                let sales_order_number = results.shift();
                handleMessage(`Get sales order number for delivery note : ${data.order_number} : ${sales_order_number}... (${index + 1}/${total_data})`);
                
                // If current delivery note doesnt have line data
                if (data.DeliveryNoteLines.length === 0) throw new Error(`There is no list in delivery note ${data.order_number}. Please check your data again. (${index + 1}/${total_data})`);

                // Get sales order lines
                handleMessage(`Creating query to open Sales Order : ${sales_order_number} for delivery note : ${data.order_number}... (${index + 1}/${total_data})`);
                query = connection.CreateQuery();
                if (!query.StartQuery("Sales:Item", "id,pnum,artex^nummer,artex^such2,artex^ypartno,artex^namebspr,yjobno,limge,mge", `kopf=${sales_order_number}`)) throw new Error(`Cannot start query for sales order : ${sales_order_number} of delivery note : ${data.order_number}. ${query.GetLastError()}`);

                let lines_sales_order = [];
                let total_lines = 0;
                while (query.GetNextRecord()) {
                  total_lines++;
                  handleMessage(`Getting sales order lines : ${sales_order_number} of delivery note : ${data.order_number}. Total lines : (${total_lines})... (${index + 1}/${total_data})`);
              
                  lines_sales_order.push({
                    item_id : query.GetFieldN('id'),
                    item_no : query.GetFieldN('pnum'),
                    part_id : query.GetFieldN('artex^nummer'),
                    part_name : query.GetFieldN('artex^such2'),
                    part_number : query.GetFieldN('artex^ypartno'),
                    part_description : query.GetFieldN('artex^namebspr'),
                    job_number : query.GetFieldN('yjobno'),
                    outstanding_qty : parseInt(query.GetFieldN('limge')),
                    qty : parseInt(query.GetFieldN('mge')),
                  });
                }

                // Checking data lines exist in sales order
                let line_results = data.DeliveryNoteLines.map((line, key) => {
                  handleMessage(`Checking part with job number ${line.job_number} from sales order ${sales_order_number}... (${index + 1}/${total_data})`);
            
                  // Check if current item's job number exist in entire sales order line data
                  if (!lines_sales_order.map((item) => item.job_number).includes(line.job_number)) {
                    line.status = 'failed';
            
                    handleMessage(`Data part with job number ${line.job_number} on sales order ${sales_order_number} has not found... (${index + 1}/${total_data})`);
            
                    return false;
                  }
            
                  // Retrieve current data with entire sales order line data
                  let current_abas_data = lines_sales_order.find((item) => {
                    return item.job_number == line.job_number;
                  });
            
                  // Check if current data retrivied
                  if (typeof current_abas_data === "undefined") {
                    line.status = 'failed';
            
                    handleMessage(`Cannot get data part with job number ${line.job_number} on sales order ${sales_order_number} has not found... (${index + 1}/${total_data})`);
            
                    return false;
                  }
            
                  // Check if outstanding qty is sufficient for the delivery qty
                  if (current_abas_data.outstanding_qty < line.delivery_qty) {
                    line.abas_id = null;
                    line.part_abas_id = null;
                    line.status = 'failed';
            
                    handleMessage(`Current data's delivery quantity (${line.delivery_qty}) exceeds outstanding quantity (${current_abas_data.outstanding_qty}) on data with job number ${line.job_number} on sales order ${sales_order_number} has not found... (${index + 1}/${total_data})`);
            
                    return false;
                  }
            
                  // Update line data with current ABAS line data
                  line.abas_id = current_abas_data.item_id;
                  line.part_abas_id = current_abas_data.part_id;
                  line.status = "success";
                  line.abas_status = null;
            
                  handleMessage(`Data with job number ${line.job_number} on sales order ${sales_order_number} succeed... (${index + 1}/${total_data})`);
            
                  return line;
                });

                // Check if we get all line result
                if (line_results.filter(line => !line).length > 0) throw new Error(`Some part item is not exists in sales order ${sales_order_number}`);

                // Update sales order number
                data.sales_order_number = sales_order_number;
                data.status = 'progress';
                data.abas_status = null;

                return {
                  data: data,
                  lines: line_results
                };
              } catch (error) {
                data.status = 'failed';

                throw error;
              }
            }

            const createDeliveryNote = (data, line_results) => {
              let editor, abas_number;
              try {
                editor = connection.CreateEditor();
                const editDelivery = 7, refTypeNumSW = 2;
              
                handleMessage(`Starting delivery for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}.`);
                if (!editor.BeginEditOperation(editDelivery, "Sales", "Sales", refTypeNumSW, data.sales_order_number)) throw new Error(`Cannot begin editor for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. Error : ${editor.GetLastEDPError().ErrInfo}`);
              
                const delivery_date = new Date(`${data.delivery_date} ${data.delivery_time}`);
              
                // Fill Header.FORMULA M|auftrart = "1928"
                if (!editor.SetFieldVal('auftrart', "1928")) throw new Error(`Error : Editor cannot fill auftrart for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                if (!editor.SetFieldVal('ynopol', data.no_polisi_kendaraan)) throw new Error(`Error : Editor cannot fill ynopol for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                if (!editor.SetFieldVal('ysopir', data.nama_supir)) throw new Error(`Error : Editor cannot fill ysopir for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                if (!editor.SetFieldVal('yjam', `${delivery_date.getHours()}:${delivery_date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits : 2, useGrouping : false })}`)) throw new Error(`Error : Editor cannot fill yjam for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                if (!editor.SetFieldVal('vom', `${delivery_date.getDate()}/${(delivery_date.getMonth() + 1)}/${(delivery_date.getFullYear().toString().substr(-2))}`)) throw new Error(`Error : Editor cannot fill vom for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                if (!editor.SetFieldVal('frzeich', data.reference)) throw new Error(`Error : Editor cannot fill frzeich for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                if (!editor.SetFieldVal('zeich', data.operator)) throw new Error(`Error : Editor cannot fill zeich for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                
                // Fill Lines
                handleMessage(`Fill lines for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}.`);
                
                line_results.forEach((line, current_row) => {
                  let is_filled = false;
                  for (let line_row = 1; line_row <= editor.GetRowCount(); line_row++) {
                    if (line.part_abas_id == editor.GetFieldVal('artex^nummer', line_row)) {
                      handleMessage(`Filling lines at-${current_row + 1} for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}.`);
                      if (!editor.SetFieldVal('pnum', '', line_row)) throw new Error(`Error: Editor cannot fill pnum at line-${line_row} for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
                      if (!editor.SetFieldVal('mge', line.delivery_qty, line_row)) throw new Error(`Error: Editor cannot fill pnum at line-${line_row} for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
        
                      is_filled = true;
        
                      break;
                    }
                  }
            
                  if (!is_filled) handleMessage(`Not fill lines at-${current_row + 1} for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}.`);
                });
              
                handleMessage(`Saving delivery note for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}.`);
                if (!editor.EndEditSave()) throw new Error(`Cannot make delivery order for sales order ${data.sales_order_number}, order ${data.order_number} with reference ${data.reference}. ${editor.GetLastEDPError().ErrInfo}`);
              
                abas_number = editor.GetEditID();
                
                // Update ABAS delivery note number
                data.abas_number = abas_number;
                data.status = 'success'; 
                data.abas_status = 'success';
              
                handleMessage(`Delivery Note with order number ${data.order_number} has been created with number ${abas_number}.`);
              
                return data;
              } catch (error) {
                if (typeof editor !== "undefined") editor.EndEditCancel(); 

                data.status = 'failed';

                throw error;
              }
            }
  
            return await synchronizeProcess();
          }

          synchronizeWatcher = setInterval(async() => {
            await synchronizeTask()
          }, 1000);
        } catch (error) {
          handleError(error);
        }
      }, 1000);
    } catch (error) {
      handleError(error);
    }
  }
)();