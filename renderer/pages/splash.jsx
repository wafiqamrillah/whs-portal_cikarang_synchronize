import { useState, useEffect } from "react";

export default function Splash() {
    const [text, setText] = useState('Loading');
    const [dotCount, setDotCount] = useState(0);

    useEffect(() => {
        const handleMessage = (e, message) => setText(message);
        window.electron.message.on(handleMessage);

        const interval = setInterval(() => {
            setDotCount((prev) => {
                return (prev + 1) > 3 ? 0 : prev + 1;
            });
        }, 1000);

        return () => {
            window.electron.message.off(handleMessage);
            clearInterval(interval);
        }
    }, []);

    return (
        <div className="relative text-white">
            <div className="fixed inset-0 overflow-y-auto flex items-center">
                <div className="overflow-hidden mx-auto text-5xl">
                    <i className="fa-solid fa-spin fa-spinner"></i>
                </div>
            </div>

            <div className="fixed inset-0 flex items-end text-center justify-center">
                { text + ('.'.repeat(dotCount)) }
            </div>
        </div>
    );
}