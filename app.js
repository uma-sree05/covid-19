const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const changeStateInfo = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};

const changeDistrictInfo = (district) => {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
};

// User Login API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secretkey");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const middlewareFunction = (request, response, next) => {
  let jwtToken;
  const authorizationHeader = request.headers["authorization"];
  if (authorizationHeader !== undefined) {
    jwtToken = authorizationHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secretkey", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//GET API 2

app.get("/states/", middlewareFunction, async (request, response) => {
  const { stateId, stateName, population } = request.params;
  const getStateDetails = `
              SELECT state_id AS stateId,
              state_name AS stateName,
              population
              FROM state
              ORDER BY
               state_id;`;
  const stateInfo = await db.all(getStateDetails);
  response.send(stateInfo);
});

//GET ID API 3

app.get("/states/:stateId/", middlewareFunction, async (request, response) => {
  const { stateId } = request.params;
  const getStateId = `
            SELECT 
              *
            FROM 
              state 
            WHERE 
              state_id='${stateId}';`;

  const getState = await db.get(getStateId);
  response.send(changeStateInfo(getState));
});

//POST district API

app.post("/districts/", middlewareFunction, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrict = `
    INSERT INTO district(district_name,
    state_id,
    cases,
    cured,
    active,
    deaths) 
    VALUES(
        '${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}');`;
  await db.run(postDistrict);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  middlewareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictId = `
                SELECT 
                  * 
                FROM 
                district
                WHERE 
                   district_id='${districtId}';`;
    const getDistrict = await db.get(getDistrictId);
    response.send(changeDistrictInfo(getDistrict));
  }
);

// //DELETE DISTRICT ID API 6
app.delete(
  "/districts/:districtId/",
  middlewareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `
    DELETE FROM district
    WHERE district_id='${districtId}';`;
    const deleteDistrict = await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7 PUT
app.put(
  "/districts/:districtId/",
  middlewareFunction,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putQuery = `
    UPDATE district 
    SET 
        district_name = ${districtName},
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
        WHERE district_name = ${districtName};`;
    const putDistrict = await db.run(putQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  middlewareFunction,
  async (request, response) => {
    const { state_id } = request.params;
    const getDistrict = `
    SELECT 
      SUM(cases) AS totalCases,
      SUM(cured) AS totalCured,
      SUM(active) AS totalActive,
      SUM(deaths) AS totalDeaths 
    FROM 
      district 
    INNER JOIN state ON state.state_id = district.state_id;`;
    const districtInfo = await db.get(getDistrict);
    response.send(districtInfo);
  }
);

module.exports = app;
