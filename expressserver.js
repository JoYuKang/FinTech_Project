const express = require('express')
const app = express()
const request = require('request');
const jwt = require('jsonwebtoken');
const auth = require('./lib/auth');

//-----------데이터베이스 연결---------------
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'q1081711',
  database : 'fintech'
});
connection.connect();
//------------------------------------------

//렌더링
app.set('views',__dirname+'/views');//렌더링할 파일이 있는 디렉토리
app.set('view engine','ejs');//사용할 뷰 엔진 정의(ejs)

app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.use(express.static(__dirname+'/public'));//디자인파일이 위치할 정적 요소들을 저장할 디렉토리

//전역 변수 정의
var clientId = "w2PsmACxaPkIDozt70OjU1eHnPipYUlRDZJhkSPH"
var clientSecret = "6h1TdVPdAuqaMraQt2wzudQpGn3Ahj3VKJaRnC6E"

//라우터 추가
app.get('/test',auth,function(req,res){
  console.log(req.decoded);
  res.json('로그인 된 사용자가 보는 화면');
})

app.get('/signup',function(req,res){
  res.render('signup')
})

app.get('/login', function(req, res){
  res.render('login');
})

app.get('/main',function(req,res){
  res.render('main');
})

app.get('/balance',function(req,res){
  res.render('balance');
})

app.get('/qrcode',function(req,res){
  res.render('qrcode');
})

app.get('/qrreader',function(req,res){
  res.render('qrreader');
})

app.get('/graph',function(req,res){
  res.render('graph');
})

app.get('/submain', function(req, res){
  res.render('submain');
})

//1)인증 구현
app.get('/authResult', function(req, res){
  var authCode = req.query.code;
  console.log("인증코드 : ", authCode)
  var option = {
    method : "POST",
    url : "https://testapi.openbanking.or.kr/oauth/2.0/token",
    headers : {
      "Content-Type" : "application/x-www-form-urlencoded; charset=UTF-8"
    },
    form : {
      code : authCode,
      client_id : clientId,
      client_secret : clientSecret,
      redirect_uri : "http://localhost:3000/authResult",
      grant_type : "authorization_code"
    }
  }

  request(option, function (error, response, body) {
    var accessRequestResult = JSON.parse(body);
    console.log(accessRequestResult);
    res.render("resultChild", { data: accessRequestResult });
  });

})

//2)회원가입 구현
app.post('/signup', function(req, res){
  console.log(req.body);
  var userName = req.body.userName;
  var userPassword = req.body.userPassword;
  var userEmail = req.body.userEmail;
  var userAccessToken = req.body.userAccessToken;
  var userRefreshToken = req.body.userRefreshToken;
  var userSeqNo = req.body.userSeqNo;
  var insertUserSql = "INSERT INTO user (`name`, `email`, `accesstoken`, `refreshtoken`, `userseqno`, `password`) VALUES (?, ?, ?, ?, ?, ?)"
  connection.query(insertUserSql,[userName, userEmail, userAccessToken, userRefreshToken, userSeqNo, userPassword], function (error, results, fields) {
    if (error) throw error;
    else {
      res.json(1);
      console.log(res)
    }
  });
})

//3)로그인 구현
app.post('/login', function(req, res){
  var userEmail = req.body.userEmail;
  var userPassword = req.body.userPassword;
  var searchEmailSql = "SELECT * FROM user WHERE email = ?";
  connection.query(searchEmailSql,[userEmail, userPassword], function (error, results, fields) {
    if (error) throw error;
    else {
      if(results.length == 0){
        res.json("회원이 존재하지 않습니다")
      }
      else {
        var storedUserPassword = results[0].password;
        if(storedUserPassword == userPassword){
          //로그인 완료
          var tokenKey = "f@i#n%tne#ckfhlafkd0102test!@#%";
          jwt.sign(
            {
              userId: results[0].id,
              userEmail: results[0].email,
            },
            tokenKey,
            {
              expiresIn: "10d",
              issuer: "fintech.admin",
              subject: "user.login.info",
            },
            function (err, token) {
              console.log("로그인 성공", token);
              res.json(token);
            }
          );

        }
        else {
          res.json("비밀번호를 잘못 입력했습니다");
          //로그인 실패
        }
      }
    }
  });
})

//4)계좌 조회 구현->카드 정보
app.post('/list',auth,function(req, res){
  var userId = req.decoded.userId;
  var userSelectsql = "SELECT * FROM user WHERE id = ?";
  connection.query(userSelectsql,[userId], function (err, results) {
    if(err){throw err}
    else {
      var userAccessToken = results[0].accesstoken;
      var userSeqNo = results[0].userseqno;
      var option = {
        method : "GET",
        url : "https://testapi.openbanking.or.kr/v2.0/user/me",
        headers : {
          //토큰
          Authorization : "Bearer " + userAccessToken
        },
        //get 요청을 보낼때 데이터는 qs, post 에 form, json 입력가능
        qs : {
          user_seq_no : userSeqNo
        }
      }
      request(option, function (error, response, body) {
        var listResult = JSON.parse(body);
        console.log(listResult);
        res.json(listResult)
      });
    }    
  })
})

//5)잔액 확인 구현->남은 식비
app.post('/balance',auth,function(req,res){
  var finusenum = req.body.fin_use_num;
  var countum = Math.floor(Math.random()*1000000000) + 1;
  var transId = "T991671680U" + countum; 
  var userId = req.decoded.userId;
  var userSelectsql = "SELECT * FROM user WHERE id = ?";
  connection.query(userSelectsql,[userId], function (err, results) {
    if(err){throw err}
    else {
      var userAccessToken = results[0].accesstoken;
      var userSeqNo = results[0].userseqno;
      var option = {
        method : "GET",
        url : "https://testapi.openbanking.or.kr/v2.0/account/balance/fin_num",
        headers : {
          //토큰
          Authorization : "Bearer " + userAccessToken
        },
        //get 요청을 보낼때 데이터는 qs, post 에 form, json 입력가능
        qs : {
          bank_tran_id : transId,
          fintech_use_num : finusenum,
          tran_dtime : "20201119133400"
        }
      }
      request(option, function (error, response, body) {
        var balanceResult = JSON.parse(body);
        console.log(balanceResult);
        res.json(balanceResult)
      });
    }    
  })
})

//6)거래 내역 조회 구현
app.post('/transactionList',auth,function(req,res){
  var finusenum = req.body.fin_use_num;
  var countum = Math.floor(Math.random()*1000000000) + 1;
  var transId = "T991671680U" + countum;
  var userId = req.decoded.userId;
  var userSelectsql = "SELECT * FROM user WHERE id = ?";
  connection.query(userSelectsql,[userId], function (err, results) {
    if(err){throw err}
    else {
      var userAccessToken = results[0].accesstoken;
      var userSeqNo = results[0].userseqno;
      var option = {
        method : "GET",
        url : "https://testapi.openbanking.or.kr/v2.0/account/transaction_list/fin_num",
        headers : {
          Authorization : "Bearer " + userAccessToken
        },
        qs : {
          bank_tran_id : transId,
          fintech_use_num : finusenum,
          inquiry_type : "A",
          inquiry_base : "D",
          from_date : "20190101",
          to_date : "20190103",
          sort_order : "D",
          tran_dtime : "20201119133400"
        }
      }
      request(option, function (error, response, body) {
        var TXResult = JSON.parse(body);
        var txresults = TXResult.res_list
        console.log("세부사항은 다음과 같습니다:",txresults)
        res.json(TXResult)
      });
    }    
  })
})

//6-1)차트로 표현하기
app.post('/graph',auth,function(req,res){
  var finusenum = req.body.fin_use_num;
  var countum = Math.floor(Math.random()*1000000000) + 1;
  var transId = "T991671680U" + countum;
  var userId = req.decoded.userId;
  var userSelectsql = "SELECT * FROM user WHERE id = ?";
  connection.query(userSelectsql,[userId], function (err, results) {
    if(err){throw err}
    else {
      var userAccessToken = results[0].accesstoken;
      var userSeqNo = results[0].userseqno;
      var option = {
        method : "GET",
        url : "https://testapi.openbanking.or.kr/v2.0/account/transaction_list/fin_num",
        headers : {
          Authorization : "Bearer " + userAccessToken
        },
        qs : {
          bank_tran_id : transId,
          fintech_use_num : finusenum,
          inquiry_type : "A",
          inquiry_base : "D",
          from_date : "20190101",
          to_date : "20190103",
          sort_order : "D",
          tran_dtime : "20201119133400"
        }
      }
      request(option, function (error, response, body) {
        var TXResult = JSON.parse(body);
        var txresults = TXResult.res_list
        let groupByprint = txresults.reduce((acc, it) =>
        ({ ...acc, [it.print_content]: (acc[it.print_content] || 0) + 1 }),
        []);
        console.log(groupByprint)
        res.json(groupByprint)
      });
    }    
  })
})


//7)결제 시스템 구현->qrreader로 연결해서 출금/입금 이체 발생
//json 데이터는 내일 대표로 한분 정보 정해서 바꾸면 될 것 같아요
app.post('/withdraw',auth,function(req, res){
  var finusenum = req.body.fin_use_num;
  var to_finusenum = req.body.to_fin_use_num;
  var amount = req.body.amount;

  var countum = Math.floor(Math.random()*1000000000) + 1;
  var transId = "T991671680U" + countum;

  var userId = req.decoded.userId;
  var userSelectsql = "SELECT * FROM user WHERE id = ?";
  connection.query(userSelectsql,[userId], function (err, results) {
    if(err){throw err}
    else {
      var userAccessToken = results[0].accesstoken;
      var userSeqNo = results[0].userseqno;
      //출금이체
      var option = {
        method : "POST",
        url : "https://testapi.openbanking.or.kr/v2.0/transfer/withdraw/fin_num",
        headers : {
          Authorization : "Bearer " + userAccessToken,
        },
        JSON : 
        {
          "bank_tran_id": transId,
          "cntr_account_type" : "N",
          "cntr_account_num" : "7673960218",
          "dps_print_content" : "쇼핑몰환불",
          "fintech_use_num" : finusenum,
          "tran_amt": amount,
          "tran_dtime": "20201120101921",
          "req_client_name": "홍길동",
          "req_client_fintech_use_num" : to_finusenum,
          "req_client_num": "HONGGILDONG1234",
          "transfer_purpose": "ST",
          "recv_client_name": "강선모",
          "recv_client_bank_code":"097",
          "recv_client_account_num":"7673960218"
        }
      }

      request(option, function (error, response, body) {
        console.log(body);
        //8)입금이체 구현
        if(body.rsp_code ="A0000"){
          var countnum2 = Math.floor(Math.random() * 1000000000) + 1;
          var transId2 = "T991671680U" + countnum2;
          var option = {
            method : "POST",
            url : "https://testapi.openbanking.or.kr/v2.0/transfer/deposit/fin_num",
            headers : {
              Authorization : "Bearer " + legged_token//구현 필요
            },
            //get 요청을 보낼때 데이터는 qs, post 에 form, json 입력가능
            json : {
              "cntr_account_type": "N",
              "cntr_account_num": "1961751797",
              "wd_pass_phrase": "NONE",
              "wd_print_content": "환불금액",
              "name_check_option": "on",
              "tran_dtime": "20201120131900",
              "req_cnt": "1",
              "req_list": [
                {
                  "tran_no": "1",
                  "bank_tran_id": transId2,
                  "fintech_use_num": to_finusenum,
                  "print_content": "쇼핑몰환불",
                  "tran_amt": amount,
                  "req_client_name": "홍길동",
                  "req_client_num": "HONGGILDONG1234",
                  "req_client_fintech_use_num": finusenum,
                  "transfer_purpose": "ST"
                }
              ]
            }
          }
          request(option, function (error, response, body) {
            console.log(body);
            res.json(body);
          });
        }
      });
    }    
  })
})


app.listen(3000, function(){
    console.log('서버가 3000번 포트에서 실행중 입니다.');
})



