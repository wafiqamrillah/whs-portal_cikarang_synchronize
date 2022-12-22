import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  const [message, setMessage] = useState(null);
  const [isMessageScrolled, setIsMessageScrolled] = useState(false);
  const [lastScrollingTime, setLastScrollingTime] = useState(null);
  const [logs, setLogs] = useState([]);

  const [synchronizations, setSynchronizations] = useState([
    { name: 'delivery_note', label: 'Delivery Note', state: false, button_enable: true },
  ]);

  const handleListenerOn = (value = false) => {
    if (value) {
      window.electron.message.on(handleMessage);
      window.electron.abas.synchronize.on('status.set', handleSynchronizeStatus);
      window.electron.abas.synchronize.on('button.setEnable', (event, data) => {
        if (typeof data.name !== "undefined" && data.button_enable !== "undefined") handleSynchronizeToggleButton(data.name, data.button_enable);
      });
    } else {
      window.electron.message.off(handleMessage);
      window.electron.abas.synchronize.off('status.set', handleSynchronizeStatus);
      window.electron.abas.synchronize.on('button.setEnable', (event, data) => {
        if (typeof data.name !== "undefined" && data.button_enable !== "undefined") handleSynchronizeToggleButton(data.name, data.button_enable);
      });
    }
  }

  const handleMessage = (event, message) => {
    const currentTime = new Date();
    
    setMessage(message);
    setLogs((log) => [...log, {
      datetime : currentTime.getDate()+' '+currentTime.toLocaleString('default', {month: 'long'})+' '+currentTime.getFullYear()+' '+(currentTime.getHours() < 10 ? '0' : '')+currentTime.getHours()+':'+(currentTime.getMinutes() < 10 ? '0' : '')+currentTime.getMinutes()+':'+(currentTime.getSeconds() < 10 ? '0' : '')+currentTime.getSeconds(),
      message : message
    }]);
  };
  
  const handleMessageScroll = (e) => {
    setIsMessageScrolled(prev => !prev ? true : prev);

    setLastScrollingTime(new Date());
  }

  const logMessageElement = useRef(null);

  useEffect(() => {
    handleListenerOn(true);
    window.electron.abas.synchronize.send('status.get');

    const scrollInterval = setInterval(() => {
      // if (!isMessageScrolled) {
        const logMessageEl = logMessageElement.current;
        logMessageEl.scrollTop = logMessageEl.scrollHeight;
      // }
    }, 10000);

    const resetScrollTimeInterval = setInterval(() => {
      if (lastScrollingTime) {
        if ((Math.round(Math.abs(lastScrollingTime - new Date())) / 1000) >= 10) {
          setLastScrollingTime(null);
          setIsMessageScrolled(false);
        } 
      }
    });

    return () => {
      handleListenerOn(false);
      clearInterval(scrollInterval);
      clearInterval(resetScrollTimeInterval);
    }
  }, []);

  // Functions
  const handleSynchronizeStatus = (event, datas) => {
    setSynchronizations(
      prev => prev.map((value) => {
        value.state = datas[value.name] ?? false;
        value.label = !value.state ? "Start" : "Stop";
        return value;
      })
    );
  }

  const handleSynchronizeToggleButton = (synchronizeName, setValue = undefined) => {
    setSynchronizations(
      prev => prev.map((value) => {
        if (value.button_enable && value.name === synchronizeName && typeof setValue === "undefined") {
          window.electron.abas.synchronize.send(`toggle`, {
            name : synchronizeName,
            value : !value.state
          });

          value.button_enable = false;
        } else {
          value.button_enable = (typeof setValue !== "undefined") ? setValue : true;
        }

        return value;
      })
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Navigation Bar */}
      <nav className="fixed top-0 w-full z-30">
        <div className="h-12 px-4 py-1 bg-gradient-to-b from-blue-400 to-blue-800 flex items-center justify-center lg:justify-start shadow-lg">
          {/* Logo */}
          <div className="shrink-0 flex items-center space-x-3">
            <Image
              src={ `${router.basePath}logo.png` }
              alt="Logo PT Mah Sing Indonesia"
              width={50}
              height={50}
            />
            <span className="inline-flex items-center font-bold text-white uppercase">
              PT Mah Sing Indonesia
            </span>
          </div>
        </div>
        <div className="h-12 p-2 bg-gray-200 border-b border-gray-600 flex items-center space-x-2">
          {
            synchronizations
              .map(
                (synchronize, index) =>
                <button
                  key={ `synchronize_${synchronize.name}_${index}` }
                  disabled={ !synchronize.button_enable }
                  onClick={ () => handleSynchronizeToggleButton(synchronize.name) }
                  className="px-4 py-2 border border-gray-800 bg-gradient-to-b from-gray-200 to-gray-400 hover:to-gray-300 active:from-gray-400 active:to-gray-200 focus:from-gray-400 focus:to-gray-200 focus:outline-none focus:shadow-outline-gray-500 transition ease-in-out duration-150 rounded-md tracking-normal shadow-md focus:shadow-inner disabled:opacity-25 disabled:cursor-not-allowed">
                  <div className="flex items-center space-x-2">
                    <div className={ `w-[16px] h-[16px] rounded-full bg-gradient-to-b ${ synchronize.state ? 'from-green-400 to-green-600' : 'from-red-400 to-red-600' } border border-green-800` }></div>
                    <div>
                      { synchronize.label }
                    </div>
                  </div>
                </button>
              )
          }
        </div>
      </nav>

      {/* Main */}
      <main className="relative min-h-screen max-h-screen pt-24 pb-6 flex flex-col">
        {/* Content */}
        <div className="relative max-h-max container mt-2 mx-auto flex flex-auto flex-col space-y-2">
          <div className="flex-auto max-h-max flex flex-col space-y-2 p-2 bg-gray-200 border border-gray-400 shadow rounded-lg">
            <label htmlFor="log" className="font-bold text-sm">
              Logs
            </label>
            <div
              ref={ logMessageElement }
              onScroll={ handleMessageScroll }
              className="min-h-[275px] max-h-[275px] px-3 py-2 text-sm bg-white border border-gray-400 rounded-md overflow-hidden overflow-y-scroll">
                <ul id="log_list" className="list-disc list-inside">
                  {
                    logs.map((log, index) => <li key={ `log_${index}` }>{ `${log.datetime} : ${log.message}` }</li>)
                  }
                </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed w-full bottom-0">
        <div className="px-4 bg-gray-100 border-t border-gray-400 shadow-lg">
          <div className="grid grid-cols-2 text-sm">
            <div className="text-left">
            </div>
            <div className="text-right">
              <span>
                { (new Date()).getFullYear() }&copy;
              </span>
              <span className="font-bold">
                Synchronize
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}