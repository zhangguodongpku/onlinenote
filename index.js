var express = require("express"), path = require("path"), bodyParser = require("body-parser"), crypto = require("crypto");
var favicon = require('serve-favicon'), cookieParser = require("cookie-parser"), passport = require('passport');
var qqStrategy = require('passport-qq').Strategy;
var app = express();
var mongoose = require("mongoose");
var models = require("./models/models");
var User = models.User, Note = models.Note;

mongoose.connect("mongodb://127.0.0.1:27017/notes");
mongoose.connection.on("error", console.error.bind(console, "Fail to connect database！！"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(passport.initialize());

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

passport.use(new qqStrategy({
    clientID: "****",//你的appid
    clientSecret: "******",//你的appkey
    callbackURL: "http://www.youngshow.top/qq/callback"//回调地址
	},function(accessToken, refreshToken, profile, done) {
		return done(null, profile);
}));

app.get('/qq', passport.authenticate('qq'), function(req, res){});

app.get('/qq/callback', passport.authenticate('qq', { failureRedirect: '/login' }), function(req, res) {
    //认证成功，跳转至首页
	User.findOne({username:req.user.nickname},function(err, user){
		if(err){
			console.log(err);
			return res.redirect("/");
		}
		if(user){
			res.cookie('user', {username: req.user.nickname}, {maxAge: 1000*60*20, httpOnly:true, path:'/'});
			return res.redirect("/");
		}
	
		var md5 = crypto.createHash("md5"),
			md5password = md5.update("123456").digest("hex");
	
		var newUser = new User({
			username: req.user.nickname,
			password: md5password
		});
	
		newUser.save(function(err, doc){
			if(err){
				console.log(err);
				return res.redirect("/");
			}
			res.cookie('user', {username: req.user.nickname}, {maxAge: 1000*60*20, httpOnly:true, path:'/'});
			return res.redirect("/");
		});
	});
});

app.get("/",function(req, res){
	res.render("index", {
		user: req.cookies.user,
		title: "首页"
		});
});

app.get("/index",function(req, res){
	res.render("index", {
		user: req.cookies.user,
		title: "首页"
		});
});

app.get("/aboutus",function(req, res){
	res.render("aboutus", {
		user: req.cookies.user,
		title: "关于我们"
		});
});

app.get("/user",function(req, res){
	var result = req.query.status;
	if(!req.cookies.user){
		//未登录！
		return res.redirect("/login");
	}
	if(result == "success"){
		res.render("user", {
			feedbackSuccess: "密码修改成功！",
			feedbackFail: "",
			user: req.cookies.user,
			title: "用户中心"
		});
	}else if(result == "fail"){
		res.render("user", {
			feedbackSuccess: "",
			feedbackFail: "原密码不正确！",
			user: req.cookies.user,
			title: "用户中心"
		});
	}else{
		res.render("user", {
			feedbackSuccess: "",
			feedbackFail: "",
			user: req.cookies.user,
			title: "用户中心"
		});
	}
});

app.get("/register", function(req, res){
	var result = req.query.status;
	if(req.cookies.user){
		//已经登录！
		return res.redirect("/");
	}
	//注册！
	if(result == "fail"){
		res.render("register", {
			feedback: "用户名已经存在！",
			user: "",
			title: "注册"
		});
	}else{
		res.render("register", {
			feedback: "",
			user: "",
			title: "注册"
		});
	}
});

app.get("/login", function(req, res){
	var result = req.query.status;
	if(req.cookies.user){
		//已经登录！
		return res.redirect("/");
	}
	//登录！
	if(result == "failuser"){
		res.render("login", {
			feedbackuser: "用户名不存在！",
			feedbackpwd: "",
			user: "",
			title: "登录"
		});
	}else if(result == "failpwd"){
		res.render("login", {
			feedbackuser: "",
			feedbackpwd: "密码不正确！",
			user: "",
			title: "登录"
		});
	}else{
		res.render("login", {
			feedbackuser: "",
			feedbackpwd: "",
			user: "",
			title: "登录"
		});
	}
});

app.get("/quit", function(req, res){
	res.clearCookie('user');
	//退出
	return res.redirect("/login");
});

app.get("/post", function(req, res){
	//发布笔记
	if(!req.cookies.user){
		//登录之后才能发表文章！
		return res.redirect("/login");
	}
	res.render("post", {
		user: req.cookies.user,
		title: "发布"
		});
});

app.get("/list", function(req, res){
	//笔记列表！
	if(!req.cookies.user){
		//登录之后才能查看笔记！
		return res.redirect("/login");
	}
	User.findOne({username: req.cookies.user.username}, function(err, user){
		if(err){
			console.log(err);
			return res.redirect("/login");
		}
		if(!user){
			//登录之后才能查看笔记！
			return res.redirect("/login");
		}
	});
	Note.find({author: req.cookies.user.username}, function(err, note){
		var i = 0, notelist = [], currentPage = 1;
		if(err){
			console.log(err);
			return res.redirect("/login");
		}
		if(!note){
			//没有笔记记录！
			return res.redirect("/post");
		}
		var noteLength = note.length,
			numOfPage = 6,
			pageNum = Math.ceil(noteLength/numOfPage),
			lastPageNum = noteLength%numOfPage;
		if(req.query.page){
			getPage = parseInt(req.query.page, 10);
			if(getPage < 1){
				currentPage = 1;
			}else if(getPage > pageNum){
				currentPage = pageNum;
			}else{
				currentPage = getPage;
			}
		}
		
		var nextPage = Math.min((currentPage + 1), pageNum);
		var prePage = Math.max((currentPage - 1), 1);
		for(i=numOfPage*(currentPage - 1);i<Math.min(numOfPage*currentPage, noteLength);i++){
			notelist.push({
				id: note[i].id,
				title: note[i].title,
				tag: note[i].tag,
				time: dateff(note[i].createTime)
				});
		}
		res.render("list", {
			user: req.cookies.user,
			title: "笔记列表",
			notelist: notelist,
			pages: {
				nums: pageNum,
				curpage: currentPage,
				nextpage: nextPage,
				prepage: prePage
			}
			});
	}).sort({"createTime": -1});
	
});

app.get("/detail", function(req, res){
	var noteid = req.query.notes;
	//查看笔记！
	if(!req.cookies.user){
		//登录之后才能查看笔记！
		return res.redirect("/login");
	}
	Note.findById(noteid, function(err, note){
		if(err){
			console.log(err);
			return res.redirect("/login");
		}
		if(!note){
			//没有笔记记录！
			return res.redirect("/post");
		}
		var contents = note.content.split(/\r\n/);
		var notes = {
			title: note.title,
			author: note.author,
			tag: note.tag,
			content: contents,
			time: dateff(note.createTime)
		};
		res.render("detail", {
			user: req.cookies.user,
			title: "笔记详情",
			notes: notes
			});
	});
});

app.post("/register", function(req, res){
	var username = req.body.username,
		password = req.body.password,
		passwordRepeat = req.body.passwordRepeat;
	
	if(username.trim().length == 0){
		//用户名不能为空！
		return res.redirect("/register");
	}
	if(password.trim().length == 0){
		//密码不能为空！
		return res.redirect("/register");
	}
	if(password != passwordRepeat){
		//两次输入的密码不一致！
		return res.redirect("/register");
	}
	User.findOne({username:username},function(err, user){
		if(err){
			console.log(err);
			return res.redirect("/register");
		}
		if(user){
			//用户名已经存在！
			return res.redirect("/register?status=fail")
		}
	
		var md5 = crypto.createHash("md5"),
			md5password = md5.update(password).digest("hex");
	
		var newUser = new User({
			username: username,
			password: md5password
		});
	
		newUser.save(function(err, doc){
			if(err){
				console.log(err);
				return res.redirect("/register");
			}
			//注册成功！
			res.cookie('user', {username: username}, {maxAge: 1000*60*20, httpOnly:true, path:'/'});
			return res.redirect("/login");
		});
	});
});

app.post("/user", function(req, res){
	var username = req.cookies.user.username,
		originalPassword = req.body.originalPassword,
		newPassword = req.body.newPassword,
		newPasswordRepeat = req.body.newPasswordRepeat;
	
	if(username.trim().length == 0){
		//登录后才能修改密码！
		return res.redirect("/login");
	}
	if(newPassword.trim().length == 0){
		//新密码不能为空！
		return res.redirect("/user");
	}
	if(newPassword != newPasswordRepeat){
		//两次输入的密码不一致！
		return res.redirect("/user");
	}
	var md5 = crypto.createHash("md5"),
		md6 = crypto.createHash("md5"),
		orgpwd = md5.update(originalPassword).digest("hex");
		md5password = md6.update(newPassword).digest("hex");
	User.findOneAndUpdate({username:username, password: orgpwd}, {$set:{password: md5password}}, function(err, user){
		if(err){
			console.log(err);
			return res.redirect("/user");
		}
		if(user){
			res.redirect("/user?status=success");
		}else{
			res.redirect("/user?status=fail");
		}
	});
});

app.post("/login", function(req, res){
	var username = req.body.username,
		password = req.body.password,
		check = req.body.checkbox;
	
	User.findOne({username: username}, function(err, user){
		if(err){
			console.log(err);
			return res.redirect("/login");
		}
		if(!user){
			//用户不存在！
			return res.redirect("/login?status=failuser");
		}
		var md5 = crypto.createHash("md5"),
			md5password = md5.update(password).digest("hex");
		if(user.password !== md5password){
			//密码错误！
			return res.redirect("/login?status=failpwd");
		}
		//登录成功！
		user.password = null;
		delete user.password;
		var life = 1000*60*20;
		if(check){
			life = 1000*60*60*24*7
		};
		res.cookie('user', user, {maxAge: life, httpOnly:true, path:'/'});
		return res.redirect("/");
	});
});

app.post("/post", function(req, res){
	var title = req.body.title,
		tag = req.body.tag,
		content = req.body.content;
	
	if(!title){
		//标题不能为空！
		return res.redirect("/post");
	}
	if(!req.cookies.user){
		//登录之后才能发表文章！
		return res.redirect("/login");
	}
	
	var note = new Note({
		title: title,
		author: req.cookies.user.username,
		tag: tag,
		content: content
	});
	
	note.save(function(err, doc){
		if(err){
			console.log(err);
			return res.redirect("/post");
		}
		//文章发表成功！
		return res.redirect("/list");
	});
});

app.listen(80, function(req, res){
	console.log("App running.");
});

function dateff(date){
	var mm = date.getMonth() + 1;
	var datetime = date.getFullYear()+"-"+dble(mm)+"-"+dble(date.getDate())+"  "+dble(date.getHours())+":"+dble(date.getMinutes())+":"+dble(date.getSeconds());
	return datetime;
}

function dble(time){
	lengthOfTime = time.toString().length;
	if(lengthOfTime == 1){
		return "0"+time.toString();
	}else{
		return time.toString();
	}
}