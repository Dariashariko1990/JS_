"use strict";

let id = location.hash.replace(/^#/, '');


const menu = document.getElementsByClassName("menu")[0],
burger = document.getElementsByClassName("burger")[0],
commentsForm = document.getElementsByClassName("comments__form")[0],
commentBar = document.getElementsByClassName("comments")[0],
drawBar = document.getElementsByClassName("draw")[0],
shareTools = document.querySelector(".menu__item.share-tools"),
shareBar = document.querySelector(".menu__item.share"),
modes = document.querySelectorAll(".menu__item.mode");

const toggle = document.querySelectorAll(".menu__toggle"),
wrap = document.querySelector(".wrap"),
canvasTag = document.createElement("canvas"),
urlShare = shareTools.querySelector("input"),
canvas = document.querySelector("canvas");

//Удаляем пример ноды комментария
wrap.removeChild(commentsForm);


//Включаем режим по умолчанию(загрузка картинки) при открытии страницы
//Если картинка была загружена, а пользователь обновил страницу, устанавливаем ее из sessionstorage и показываем меню в режиме, в котором оно было до перезагрузки страницы
//Открываем соединение web-soket при перезагрузке страницы или копировании ссылки


const imageCurrent = document.querySelector(".current-image");
let connection;

if (id) {
  webSocketConnect(id);
  changeMenuMode();
} else if (sessionStorage.getItem("image") !== null) {
  setImageToCanvas(sessionStorage.getItem("image"));
  updateMenuMode();
  id = sessionStorage.getItem("imageID");
  webSocketConnect(id);
} else {
  showDownload();
}

function webSocketConnect(id){
  connection = new WebSocket(`wss://neto-api.herokuapp.com/pic/${id}`);
  connection.addEventListener('message', showMessage);
}

function updateMenuMode() {
  if (sessionStorage.getItem("menuMode") == "comments") {
    showComments();
  } else if (sessionStorage.getItem("menuMode") == "draw") {
    showDraw();
  } else if (sessionStorage.getItem("menuMode") == "download") {
    showDownload();
  } else if (sessionStorage.getItem("menuMode") == "share") {
    changeMenuMode();
  }
}

//Функции открытия меню в различных режимах
//Режим "Загрузить новое"
function showDownload() {
  menu.dataset.state = "initial";
  burger.style.display = "none";
  menu.style.visability = "hidden";
  sessionStorage.setItem("menuMode","download");
}

//Режим "Поделиться"
function changeMenuMode(){
  for (let mode of modes) {
    mode.dataset.state = "";
  };
  menu.dataset.state = "selected";
  shareBar.dataset.state = "selected";
  shareBar.nextElementSibling.style.display = "inline-block";
  burger.style.display = "inline-block";
  sessionStorage.setItem("menuMode","share");
  if  (localStorage.getItem("url")){
    urlShare.value = localStorage.getItem("url");
  }
  canvas.removeEventListener("click", appendComment);
}

shareBar.addEventListener("click",changeMenuMode);

//Режим "Комментарии"
function showComments(){
  for (let mode of modes) {
    mode.dataset.state = "";
  };
  menu.dataset.state = "selected";
  commentBar.dataset.state = "selected";
  commentBar.nextElementSibling.style.display = "inline-block";
  burger.style.display = "inline-block";
  switchCommentsMarks();
  sessionStorage.setItem("menuMode","comments");
  canvas.addEventListener("click", appendComment);
}

commentBar.addEventListener("click", showComments);

//Режим "Рисовать"
function showDraw(){
  for (let mode of modes) {
    mode.dataset.state = "";
  };
  menu.dataset.state = "selected";
  drawBar.dataset.state = "selected";
  drawBar.nextElementSibling.style.display = "inline-block";
  burger.style.display = "inline-block";
  sessionStorage.setItem("menuMode","draw");

  canvas.addEventListener("mousedown", (evt) => {
  if (sessionStorage.getItem("menuMode") == "draw"){
  drawing = true;
  weird = evt.shiftKey; 
  undone = [];

  const curve = []; 

  curve.push(makePoint(evt.offsetX, evt.offsetY, weird)); 
  curves.push(curve); 
  needsRepaint = true;
  }
});

canvas.addEventListener("mouseup", (evt) => { 
  drawing = false;
  sendMask(connection);
});

canvas.addEventListener("mouseleave", (evt) => {
  drawing = false;
});

canvas.addEventListener("click", (evt) => {
  curves.length = 0;
});

canvas.addEventListener("mousemove", (evt) => {
  if (drawing) {
    const point = makePoint(evt.offsetX, evt.offsetY, weird)
    curves[curves.length - 1].push(point);
    needsRepaint = true;
  }
});
}

drawBar.addEventListener("click", showDraw);

//Реализуем загрузку картинки на сервер

const fileInput = document.querySelector("#newImage"),
error = document.getElementsByClassName("error")[0];

fileInput.addEventListener("change", sendFile);

function setImageToCanvas(image) {
	imageCurrent.src = image;
}

function sendFile(e) {
  let file = e.type === "drop" ? e.dataTransfer.files[0] : e.currentTarget.files[0];

  //проверка типа и расширения загружаемых файлов
  if (file.type != "image/jpeg" && file.type != "image/png") {
    //отображаем сообщение об ошибке, скрыв меню
    error.style.display= "inline-block";
    menu.dataset.state = "selected";
    drag.style.display = "none";

    //Через timeout возвращаем меню, убираем сообщение об ошибке
    setTimeout(updateMenuMode, 4000);
    setTimeout(showMenu, 4000);
  } else {
    //убираем сообщение об ошибке (если оно показано в этот момент)
    error.style.display= "none";

    const formData = new FormData();
    formData.append("title", file.name);
    formData.append("image", file);

    const xhr = new XMLHttpRequest();

    xhr.open("POST", "https://neto-api.herokuapp.com/pic", true);
    xhr.addEventListener("loadstart", switchPreloader);
    xhr.addEventListener("loadend", () => {
      if (xhr.status === 200){
        console.log(`Файл ${file.name} сохранен.`);
        switchPreloader();
        changeMenuMode();

        let responseParsed = JSON.parse(xhr.responseText);
        setImageToCanvas(responseParsed.url);
        sessionStorage.setItem("image", responseParsed.url);
        sessionStorage.setItem("imageID", responseParsed.id);

        let url = `${location.href}#${responseParsed.id}`
        localStorage.setItem("url", url);
        changeMenuMode();
        
        //Открываем веб-собкет соединение. 
        webSocketConnect(responseParsed.id);
        id = responseParsed.id;

      } else {
        switchPreloader();
        errorNet(xhr.status);
        console.log(`Файл ${file.name} не был сохранен. Код ошибки ${xhr.status}.`);
      }
    });
    xhr.send(formData);

    //Убираем обработчик события drop, чтобы запретить перетаскивание нового файла, добавляем новый на показ ошибки. 
    dragToArea.removeEventListener("drop", sendFile);
    dragToArea.addEventListener("drop", errorDrag);
  }
}

const errorMessage = document.getElementsByClassName("error__message")[0];

function errorDrag() {
  errorMessage.innerHTML = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';
  error.style.display= "inline-block";
  menu.style.display = "none";
  //через setTimeout убираем сообщение об ошибке и возвращаем меню
  setTimeout(updateMenuMode, 4000);
  setTimeout(showMenu, 4000);
}

function errorNet(status) {
  errorMessage.innerHTML = `Произошла ошибка на сервере. Код ошибки ${status}`;
  error.style.display= "inline-block";
  menu.style.display = "none";
  //через setTimeout убираем сообщение об ошибке и возвращаем меню
  setTimeout(updateMenuMode, 4000);
  setTimeout(showMenu, 4000);
}

//Функция вотображения меню после скрытия
function showMenu() {
  error.style.display= "none";
  menu.style.display = "inline-block";
  drag.style.display = "inline-block";
}

//Функция переключения состояния preloader
const preloader = document.querySelector(".image-loader");

function switchPreloader() {
  if (preloader.style.display === "inline-block") {
    preloader.style.display = "none";
    menu.style.display = "inline-block";
  } else {
    preloader.style.display = "inline-block";
    menu.style.display = "none";
  }
}

//Реализуем кнопку копировать ссылку в буфер
let copyText = document.getElementsByClassName("menu_copy")[0];
copyText.addEventListener("click", copyURL);

function copyURL() {
  urlShare.select();
  document.execCommand("copy");
}

//Drag&Drop файлов 
const dragToArea = document.querySelector(".wrap");

dragToArea.addEventListener("drop", (e) => {
  e.preventDefault();
});

dragToArea.addEventListener("dragover", (e) => {
  e.preventDefault();
});

if (id || sessionStorage.getItem("image") !== null) {
  dragToArea.addEventListener("drop", errorDrag);
} else {
  dragToArea.addEventListener("drop", sendFile);
}

//Плавающее меню

//Реализуем сохранение позиции меню после  обновления страницы.
menu.style.left = localStorage.getItem("xCoord");
menu.style.top = localStorage.getItem("yCoord");

let drag = document.getElementsByClassName("drag")[0];

let coords,
isDragging = false,
shiftX = 0,
shiftY = 0,
minY, minX, maxX, maxY;

drag.addEventListener("mousedown", down);
document.addEventListener("mousemove", move);
document.addEventListener("mouseup", up);

function down(e) {
  isDragging = true;
  coords = getCoords(menu);
  shiftX = e.pageX - coords.left;
  shiftY = e.pageY - coords.top;

  minY = 0;
  minX = 0;
  maxX = document.body.clientWidth - menu.offsetWidth;
  maxY =  document.body.clientHeight - menu.offsetHeight;

  menu.style.position = "absolute";
  menu.style.zIndex = 1000;
}

function move(e) {
  if (isDragging === false) {
    return
  };

  let x = e.pageX - shiftX,
  y = e.pageY - shiftY;

  x = Math.min(x, maxX);
  y = Math.min(y, maxY);
  x = Math.max(x, minX);
  y = Math.max(y, minY);

  menu.style.left = x + "px";
  menu.style.top = y + "px";
}

function up(e) {
  isDragging = false;
  localStorage.setItem("xCoord",menu.style.left);
  localStorage.setItem("yCoord",menu.style.top);
}

function getCoords(elem) {   
  let box = elem.getBoundingClientRect();
  return {
    top: box.top + pageYOffset,
    left: box.left + pageXOffset
  };
}

//Функционал меню burger
burger.addEventListener("click", showBurgerMenu);

function showBurgerMenu() {
  burger.style.display = "none";
  for (let mode of modes) {
    mode.dataset.state = "selected";
    if (mode.nextElementSibling.classList.contains("tool")){
      mode.nextElementSibling.style.display = "none";
    }
  }
}

modes[0].addEventListener("click",showDownload);

//РФункционал переключенния кнопки отобразить/скрыть комментарии
for (let t of toggle) {
 t.addEventListener("change", switchCommentsMarks);
}

function switchCommentsMarks() {
  let commentsForms = document.getElementsByClassName("comments__form");
  
  for (let comment of commentsForms){
    if (toggle[0].checked) {
      comment.style.display = "inline-block";
    } else {
      comment.style.display = "none";
    } 
  }
} 

//Конструктор ноды формы комментария
function createCommentNode() {
  const commentForm = document.createElement("form");
  commentForm.className = "comments__form";
  
  const marker = document.createElement("span");
  marker.className = "comments__marker";

  const markerCheckbox = document.createElement("input");
  markerCheckbox.className = "comments__marker-checkbox";
  markerCheckbox.setAttribute("type", "checkbox");

  const commentsBody = document.createElement("div");
  commentsBody.className = "comments__body";

  const commentsInput = document.createElement("textarea");
  commentsInput.className = "comments__input";
  commentsInput.setAttribute("type", "text");
  commentsInput.setAttribute("placeholder", "Напишите ответ...");
  
  const commentClose = document.createElement("input");
  commentClose.className = "comments__close";
  commentClose.setAttribute("type", "button");
  commentClose.setAttribute("value", "Закрыть");
  
  const commentSubmit = document.createElement("input");
  commentSubmit.className = "comments__submit";
  commentSubmit.setAttribute("type", "submit");
  commentSubmit.setAttribute("value", "Отправить");

  const loader = document.createElement("div");
  loader.className = "loader";
  loader.style.display = "none";

  const point = document.createElement("span");
  const point1 = document.createElement("span");
  const point2 = document.createElement("span"); 
  const point3 = document.createElement("span");
  const point4 = document.createElement("span");
  loader.appendChild(point);
  loader.appendChild(point1);
  loader.appendChild(point2);
  loader.appendChild(point3);
  loader.appendChild(point4);

  commentsBody.appendChild(loader);
  commentsBody.appendChild(commentsInput);
  commentsBody.appendChild(commentClose);
  commentsBody.appendChild(commentSubmit);

  commentForm.appendChild(marker);
  commentForm.appendChild(markerCheckbox);
  commentForm.appendChild(commentsBody);

  
  return commentForm;
}

//Конструктор нового комментария внутри формы
function addComment() {

  const commentOne = document.createElement("div");
  commentOne.className = "comment";

  const commentTime = document.createElement("p");
  commentTime.className = "comment__time";
  
  const commentMessage = document.createElement("p");
  commentMessage.className = "comment__message";
  commentOne.appendChild(commentTime);
  commentOne.appendChild(commentMessage);

  return commentOne;
}

//Функция, вставляющая комментарий в DOM
function appendComment(e, left, top){
  if (sessionStorage.getItem("menuMode") == "draw"){
    return
  };

  let forms = document.getElementsByClassName("comments__body");  
  for (let forma of forms){ 
    if(forma.querySelectorAll(".comment").length === 0){
     forma.parentElement.remove();
    }   
   }
      
  let newComment = createCommentNode();
  if (left === undefined){
    newComment.style.top = e.clientY +'px';
    newComment.style.left = e.clientX +'px';
  } else {
    newComment.style.top = top +'px';
    newComment.style.left = left +'px';
  }
  
  newComment.style.zIndex = "900";
  wrap.appendChild(newComment);

  let closeButton = newComment.querySelector (".comments__close"),
  sendButton = newComment.querySelector (".comments__submit"),
  form = newComment.querySelector (".comments__body"),
  commentMark = newComment.querySelector(".comments__marker-checkbox");

  hideCommentsForm();

  form.style.display = "inline-block";

  closeButton.addEventListener("click", closeForm);
  sendButton.addEventListener("click", sendComment);
  commentMark.addEventListener("click", showCommentsForm);

  return newComment;
}

function closeForm(e){
  let form = e.target.parentElement;
  if(form.querySelectorAll(".comment").length === 0){
    form.parentElement.remove();
  } else {
    form.style.display = "none";
  }
}

function showCommentsForm(e){
  hideCommentsForm();
  e.target.nextElementSibling.style.display = "inline-block";
}

//Фуекция скрытия всех форм комментариев
function hideCommentsForm() {
  //let formTarget = e.target.parentElement;
  let forms = document.getElementsByClassName("comments__body");  
  for (let form of forms){ 
    //if(form.querySelectorAll(".comment").length === 0){
     // form.parentElement.remove();
    //} else {
      form.style.display = "none"; 
    }
}
  //e.target.parentElement.style.display = "inline-block";


//Добавляем функционал отправки комментария на сервер
function sendComment(e){
  e.preventDefault();
  const formParent = this.parentElement.parentElement,
  textarea = formParent.querySelector (".comments__input"),
  loader = textarea.previousElementSibling;
  let imageID = (id) ? id : sessionStorage.getItem("imageID"); 

  //Отправляем комментарий на сервер
  const message = 'message=' + encodeURIComponent(textarea.value) + '&left=' + encodeURIComponent(parseInt(formParent.style.left)) + '&top=' + encodeURIComponent(parseInt(formParent.style.top));

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `https://neto-api.herokuapp.com/pic/${imageID}/comments`, true);

  xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
  xhr.addEventListener("loadstart", ()=> {loader.style.display = "inline-block";});

  xhr.addEventListener("loadend", () => {
    if (xhr.status === 200){
      textarea.value = "";
      loader.style.display = "none";
    } else {
      console.log(`Комментарий не был сохранен. Код ошибки ${xhr.status}`);
    }
  });
  xhr.send(message);
  
}

function insertCommentHTML(commentText, formParent){
  let textarea = formParent.querySelector (".comments__input");
  
  let pText = commentText.querySelector(".comment__message");
  pText.innerText = textarea.value;

  let pTime = commentText.querySelector(".comment__time");
  let date = new Date();
  
  pTime.innerText = date.toLocaleDateString() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

//Прописываем стили для канвас, чтобы он был на весь экран, и лежал поверх изображения
canvas.style.position = "absolute";
canvas.style.display = "block";
canvas.style.zIndex = "800";
canvas.width = document.documentElement.clientWidth;
canvas.height = document.documentElement.clientHeight;


//При изменении размера окна браузера, адаптируем canvas и маску 
window.addEventListener('resize', function(e) {
  canvas.width = document.documentElement.clientWidth;
  canvas.height = document.documentElement.clientWidth;
  mask.width = document.documentElement.clientWidth;
  mask.height = document.documentElement.clientHeight;
})


//Комментарии должны лежать сверху маски, чтобы при клике срабатывало открытие
commentsForm.style.zIndex = "900";

//Реализуем рисование
const ctx = canvas.getContext("2d");
let color;

const BRUSH_RADIUS = 4;

let curves = [];
let undone = [];
let drawing = false;
let weird = false;
let needsRepaint = false;

function circle(point) {
  ctx.beginPath();
  ctx.fillStyle = setColor();
  ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
  ctx.fill();
}

function smoothCurveBetween (p1, p2) {
  const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
  ctx.quadraticCurveTo(...p1, ...cp);
}

function smoothCurve(points) {
  ctx.beginPath();
  ctx.strokeStyle = setColor();
  ctx.lineWidth = BRUSH_RADIUS;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.moveTo(...points[0]);

  for(let i = 1; i < points.length - 1; i++) {
    smoothCurveBetween(points[i], points[i + 1]);
  }
  ctx.stroke();
}

function makePoint(x, y, reflect = false) {
  return  reflect ? [y, x] : [x, y];
};


function repaint () {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  curves
    .forEach((curve) => {
      circle(curve[0]);

      smoothCurve(curve);
    });
}

function tick () {
  if(needsRepaint) {
    repaint();
    needsRepaint = false;
  }
  window.requestAnimationFrame(tick);
}

tick();


//Выбор цвета
let colorModes = document.querySelectorAll(".menu__color");

function setColor(){
  for (let color of colorModes){
   if (color.checked === true){
     return color.value;
   }
  }
}


//Вебсокет, обновление интерфейса в реальном режиме

function showMessage(e){
  let response = JSON.parse(e.data);
  console.log(response);
  parseMessage(response);
}


function parseMessage(message){
  if (message.event === "comment"){
    appendCommentSocket(message.comment);
  } else if (message.event === "pic"){
    setImageToCanvas(message.pic.url);
    getImageInfo(message.pic.id);
    if (message.pic.mask !== undefined){
      updateMask(message.pic.mask);}
      appendCommentSocket(message.comments);
  } else if (message.event === "mask"){
    updateMask(message.url);
  }
}

function appendCommentSocket(message){
  
  let commments = document.querySelectorAll(".comments__form");

  for (let comment of commments){
    if(parseInt(comment.style.top) === message.top && parseInt(comment.style.left) === message.left){
      let commentText = addComment();
      //создали новый комментарий ноду
      let textarea = comment.querySelector(".comments__input");
      let loader = textarea.previousElementSibling;
      let body = comment.querySelector(".comments__body");
      body.insertBefore(commentText, loader);
      //вставили в dom 
  
      let pText = commentText.querySelector(".comment__message");
      pText.innerText = message.message;
      console.log(pText.innerText);

      let pTime = commentText.querySelector(".comment__time");
      let date = new Date(message.timestamp);
  
      pTime.innerText = date.toLocaleDateString() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
      console.log("сработало true");
      return;
    }
  } 
      console.log("сработало false");
      let form = appendComment(null, message.left, message.top);
      //вставили новую форму, в переменной теперь форма
      let commentText = addComment();
      //создали новый комментарий ноду
      let textarea = form.querySelector(".comments__input");
      let body = form.querySelector(".comments__body");
      let loader = textarea.previousElementSibling;
      body.insertBefore(commentText, loader);
      //вставили в dom 
      if (!toggle[0].checked) {
        form.style.display = "none";
      }
  
      let pText = commentText.querySelector(".comment__message");
      pText.innerText = message.message;
      console.log(pText.innerText);

      let pTime = commentText.querySelector(".comment__time");
      let date = new Date(message.timestamp);
  
      pTime.innerText = date.toLocaleDateString() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
      hideCommentsForm();
}

//Функция запроса к серверу для получения информации о изображении
function getImageInfo(id){

  const xhr = new XMLHttpRequest();
  xhr.open("GET", `https://neto-api.herokuapp.com/pic/${id}`, true);

  xhr.addEventListener("loadend", () => {
    if (xhr.status === 200){
      let responseParsed = JSON.parse(xhr.responseText);
      console.log(responseParsed);
      updateImage(responseParsed);
      } else {
        console.log(`Произошла ошибка при запросе на сервер. Код ошибки ${xhr.status}`);
      }
    });
  xhr.send();

}

function updateImage(response){
  if (counter !== 2){
  let comments = response.comments;
  for (let comment in comments){
    appendCommentSocket(comments[comment]);
  }
 }
}

//Коллективное рисование
let maskTag = document.createElement("img");
let mask = wrap.insertBefore(maskTag, canvas);

mask.style.zIndex = "700";
mask.style.position = "absolute";
mask.style.display = "none";

mask.width = document.documentElement.clientWidth;
mask.height = document.documentElement.clientHeight;


function sendMask(connection){
  canvas.toBlob(img => connection.send(img));
  console.log("сработала sendMask");
}

//Так как у сервера есть особенность, он не склеивает маску с первого соединения. 
//Начинает склеивать только если нарисовать линию первую и потом передодключить соединение.
//Поэтому введен счетчик, чтобы зафиксировать первую линию, затем захардкодено переподключение сокета.
let counter = 0;

function updateMask(url){
 counter++;
 if (counter === 1) {
  connection.close();
  webSocketConnect(id);
 }
 mask.style.display = "block";
 ctx.clearRect(0, 0, canvas.width, canvas.height);
 mask.src = url;

}
