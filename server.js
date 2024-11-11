import express from "express";
import cors from "cors";
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js';
import timeout from 'connect-timeout';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase_client = createClient(supabaseUrl, supabaseKey)

const supabaseCredential = (token) => {
    return createClient(supabaseUrl, supabaseKey, {
        'global': {
            'headers': {
                'Authorization': `Bearer ${token}`
            }
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
        }
    }
    )
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

const app = express();
const port = 8080; //port number from 0 to 2^16


app.use(timeout(120000)); // set the timeout to 2 minutes
app.use(haltOnTimedout);

app.use(express.json());
app.use(cors({ origin: 'https://spa-frontend-aerzpc3vz-jjlin3s-projects.vercel.app' })); // specific on the origin that allow to access to this server 
app.use(express.urlencoded({ extended: true }));

//login related function
const tokenExpiry = (token) => {
    const decoded = jwt.decode(token);

    if (decoded) {
        if (decoded.exp < Date.now() / 1000) {
            return ("TokenExpiredError");
        } else {
            return ("TokenValid");
        }
    }
    return ("TokenExpiredError");
};

async function signin(username, password) {
    const { data, error } = await supabase_client.auth.signInWithPassword({ email: username, password: password })
    if (error) return error;

    const token = data.session
    return token;
};

//end of login related function

//users related function

async function getAllUser(token) {
    try {
        const { data: users, error } = await supabaseCredential(token).from('users').select('*')
        if (error) throw error

        console.log('All users:', users)
        return users;
    } catch (error) {
        console.error('Error getting users:', error)
    }
}

async function addUser(username, password, token) {
    try {
        const { data, error } = await supabaseCredential(token).auth.signUp({ email: username, password: password })

        if (error) throw error

        return data;
    } catch (error) {

        console.error('Error adding auth user:', error)
        throw error
    }
};

async function deleteUser(id) {
    console.log("deleteId: " + id)

    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
        console.error(error);
        return;
    }

    console.log('User deleted successfully');
};

//end of users related function

//Flight Log related function

async function getAllFlightLogs(token) {
    try {
        const { data: flightLogs, error } = await supabaseCredential(token).from('FlightLogs').select('*')
        if (error) throw error

        console.log('All flight logs:', flightLogs)
        return flightLogs;
    } catch (error) {
        console.error('Error getting users:', error)
    }
};

async function getFlightLog(flightId, token) {
    try {
        const { data: flightLogs, error } = await supabaseCredential(token).from('FlightLogs').select('*').eq('flightId', flightId)
        if (error) throw error

        console.log('All flight logs:', flightLogs)
        return flightLogs;
    } catch (error) {
        console.error('Error getting users:', error)
    }
};

async function addFlightLog(tailNumber, flightId, takeoff, landing, duration, token) {

    const { data: { user } } = await supabase_client.auth.getUser(token)

    const result = await supabaseCredential(token).from('FlightLogs').insert({ tailNumber: tailNumber, flightId: flightId, takeoff: takeoff, landing: landing, duration: duration }).select();

    return result;
};

async function updateFlightLog(id, tailNumber, flightId, takeoff, landing, duration, token) {

    const { data, error: updateError } = await supabaseCredential(token).from('FlightLogs').update({ tailNumber: tailNumber, flightId: flightId, takeoff: takeoff, landing: landing, duration: duration }).eq('id', id)

    if (updateError) {
        console.error(updateError);
        return;
    }
    return data;
};

async function deleteFlightLog(id, token) {
    console.log("deleteId: " + id)
    const response = await supabaseCredential(token).from('FlightLogs').delete().eq('id', id)

    console.log('Flight Log deleted successfully');
};

//end of flight log related function

app.listen(port, () => {
    console.log(`Single page app listening on port ${port}`);
});

//login related endpoint

app.post('/signin', async (req, res) => {
    const { username, password } = req.body
    try {
        const token = await signin(username, password)
        res.json({ token })

    } catch (error) {
        console.error(error)
        res.status(400).json({ message: 'Error signing in' })
    }
});

app.post('/signout', async (req, res) => {
    const header = req.header('Authorization')?.split(' ')[1];

    const { error } = await supabase_client.auth.signOut(header)

    if (error) return res.status(400).json({ error: error.message })
    res.status(200).json({ success: true })
});

//end of login related endpoint

//user related endpoint

app.get("/users", async (req, res) => { // get all users
    const header = req.header('Authorization')?.split(' ')[1];

    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        const users = await getAllUser(header);
        res.send(users).status(200);
    }
});

app.post("/users", async (req, res) => { // add new user
    const header = req.header('Authorization')?.split(' ')[1];
    const { username, password } = req.body;

    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        const user = await addUser(username, password, header);
        console.log("User added: ", user);
        res.send({ status: "success" }).status(200);
    }
});

app.delete("/users/:userId", async (req, res) => { //delete user
    const header = req.header('Authorization')?.split(' ')[1];
    const userId = req.params.userId;

    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        await deleteUser(userId);
        res.send({ status: "success" }).status(200);
    }
});

//end of user related endpoint

//flight log related endpoint

app.get("/flightLogs", async (req, res) => { // get all flight logs
    const header = req.header('Authorization')?.split(' ')[1];
    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        const flightLogs = await getAllFlightLogs(header);
        res.send(flightLogs).status(200);
    }
});

app.get("/flightLogs/:flightId", async (req, res) => { // get specific flight logs
    const flightId = req.params.flightId;
    const header = req.header('Authorization')?.split(' ')[1];
    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        const flightLogs = await getFlightLog(flightId, header);
        res.send(flightLogs).status(200);
    }
});

app.post("/flightLogs", async (req, res) => { // add new flight log
    const header = req.header('Authorization')?.split(' ')[1];
    const { tailNumber, flightId, takeoff, landing, duration } = req.body;
    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        const flightLog = await addFlightLog(tailNumber, flightId, takeoff, landing, duration, header);
        console.log("Flight log added: ", flightLog);
        res.send({ status: "success" }).status(200);
    }
});

app.put("/flightLogs/:flightLogId", async (req, res) => { // update flight log
    const header = req.header('Authorization')?.split(' ')[1];
    const flightLogId = req.params.flightLogId;
    const { tailNumber, flightId, takeoff, landing, duration } = req.body;
    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        const updatedUser = await updateFlightLog(flightLogId, tailNumber, flightId, takeoff, landing, duration, header);
        res.send(updatedUser).status(200);
    }
});

app.delete("/flightLogs/:flightLogId", async (req, res) => { //delete flight log
    const header = req.header('Authorization')?.split(' ')[1];
    const flightLogId = req.params.flightLogId;
    if (tokenExpiry(header) === 'TokenExpiredError') {
        return res.status(403).json({ message: 'Access token expired' });
    } else {
        await deleteFlightLog(flightLogId, header);
        res.send({ status: "success" }).status(200);
    }
});

//end of flight log related endpoint

function haltOnTimedout(req, res, next) {
    if (!req.timedout) next();
};