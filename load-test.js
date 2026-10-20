import http from 'k6/http';
import { check, sleep } from 'k6';

export function testAboutUs() {
    const res = http.get('http://127.0.0.1:4001/api/settings/aboutUs');
    check(res, {
        'status was 200': (r) => r.status === 200,
        'response time was acceptable': (r) => r.timings.duration < 200,
    });
    sleep(1);
}

export function testSendMessage() {
    const conversationId = '66fb9fddc3853b1ebe5c112c';
    const url = `http://127.0.0.1:4001/api/conversation/${conversationId}/message`;
  
    const messages = [
        "Hello, how are you?",
        "What's up?",
        "Good morning!",
        "Good evening!",
        "How's it going?",
        "Have a great day!",
        "Nice to meet you!",
        "See you soon!",
        "Take care!",
        "Goodbye!"
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const payload = JSON.stringify({
        messageType: "text",
        messageContent: randomMessage,
        mediaUrl: null
    });
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NmZjZjQzYTk1ZjM5MWFlOGM2ZWY2N2MiLCJpYXQiOjE3Mjc4NTM2NDF9.QQBtr4ogiSgy83JaUrk_pjhNKbs9G612CoPeXGuqwSk',

        },
    };
    const res = http.post(url, payload, params);
    
    if (res.status !== 201) {
        console.error(`Request failed with status ${res.status}: ${res.body}`);
    }
    
    check(res, {
        'status was 201': (r) => r.status === 201,
        'response time was acceptable': (r) => r.timings.duration < 500,
    });

    sleep(1);
}

export default function () {
    testSendMessage();
}

export const options = {
    stages: [
        { duration: '10s', target: 250 },
        { duration: '10s', target: 1000 },
        { duration: '5s', target: 0 },
    ],
    http_req_timeout: '10s',
};
