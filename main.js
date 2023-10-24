/*jshint esversion:6*/

$(function () {
    const video = $("video")[0];

    var model;
    var cameraMode = "environment"; // or "user"

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({
            audio: false,
            video: {
                facingMode: cameraMode
            }
        })
        .then(function (stream) {
            return new Promise(function (resolve) {
                video.srcObject = stream;
                video.onloadeddata = function () {
                    video.play();
                    resolve();
                };
            });
        });

    var publishable_key = "rf_vqonodBKvZhOSKm8glHVdlatY3S2";
    var toLoad = {
        model: "cash-counter",
        version: 9
    };

    const loadModelPromise = new Promise(function (resolve, reject) {
        roboflow
            .auth({
                publishable_key: publishable_key
            })
            .load(toLoad)
            .then(function (m) {
                model = m;
                resolve();
            });
    });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
        $("body").removeClass("loading");
        resizeCanvas();
        // detectFrame();
    });

    var canvas, ctx;
    const font = "16px sans-serif";

    function videoDimensions(video) {
        // 비디오의 실제 크기 및 비율을 계산
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // 화면의 가로 너비와 높이 가져오기
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // 비디오의 가로 너비와 높이 가져오기
        const videoRatio = videoWidth / videoHeight;

        // 비디오가 화면보다 더 넓을 경우, 화면 높이에 맞게 조절
        if (videoRatio > screenWidth / screenHeight) {
            return {
                width: screenHeight * videoRatio,
                height: screenHeight
            };
        } else {
            // 화면이 비디오보다 넓을 경우, 화면 가로 너비에 맞게 조절
            return {
                width: screenWidth,
                height: screenWidth / videoRatio
            };
        }
    }

    $(window).resize(function () {
        resizeCanvas();
    });

    const resizeCanvas = function () {
        $("canvas").remove();

        canvas = $("<canvas/>");

        ctx = canvas[0].getContext("2d");

        var dimensions = videoDimensions(video);

        canvas[0].width = dimensions.width;
        canvas[0].height = dimensions.height;

        canvas.css({
            width: dimensions.width + "px",
            height: dimensions.height + "px",
            left: (window.innerWidth - dimensions.width) / 2 + "px",
            top: (window.innerHeight - dimensions.height) / 2 + "px"
        });

        $("body").append(canvas);
    };

    const renderPredictions = function (predictions) {
        var dimensions = videoDimensions(video);

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        predictions.forEach(function (prediction) {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;
            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            // Draw the bounding box.
            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Draw the label background.
            ctx.fillStyle = prediction.color; detectionResults
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10);
            ctx.fillRect(x, y - textHeight, textWidth + 8, textHeight + 4);

            // Draw the text last to ensure it's on top.
            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(prediction.class, x, y - textHeight);

            console.log("detection 결과:", prediction.class);

        });
    };

    // JPY_1000, JPY_10000, JPY_2000, JPY_5000

    var prevTime;
    var pastFrameTimes = [];
    function detectFrame() {
        if (!model) {
            stopObjectDetection(); // 모델이 없을 경우 객체 인식 중지
            return;
        }

        detectFrameInterval = setInterval(function () {
            model
                .detect(video)
                .then(function (predictions) {
                    // 클래스 정보만 추출하여 detectionResults 배열에 추가
                    const classes = predictions.map(prediction => prediction.class);
                    detectionResults.push(classes);

                    // 결과를 집합(배열)에 추가
                    console.log("Detection Results:", predictions); // 결과 출력

                    renderPredictions(predictions);

                    if (prevTime) {
                        pastFrameTimes.push(Date.now() - prevTime);
                        if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                        var total = 0;
                        pastFrameTimes.forEach(function (t) {
                            total += t / 1000;
                        });

                        var fps = pastFrameTimes.length / total;
                        $("#fps").text(Math.round(fps));
                    }
                    prevTime = Date.now();
                })
                .catch(function (e) {
                    console.log("CAUGHT", e);
                    clearInterval(detectFrameInterval); // 오류가 발생하면 객체 인식 중지
                });
        },); //0.5초마다 객체검출
    }
    // const classToValueMap = {
    //     "JPY_1000": 1000,
    //     "JPY_10000": 10000,

    // };
    // -------------------------------------------------------------------------

    // 버튼 클릭 이벤트 처리
    document.getElementById("startDetection").addEventListener("click", function () {
        // 객체 인식 로직을 시작
        startObjectDetection();


        // 3초 후 객체 인식을 멈추고 결과를 출력합니다.
        setTimeout(function () {
            stopObjectDetection();
            console.log("객체 인식 결과:", detectionResults);

            function findMode(arr) {
                let mode = null;
                let maxCount = 0;
                const count = {}; // 클래스별 등장 횟수를 저장할 객체

                for (const item of arr) {
                    if (!count[item]) {
                        count[item] = 1;
                    } else {
                        count[item]++;
                    }

                    if (count[item] > maxCount) {
                        maxCount = count[item];
                        mode = item;
                    }
                }

                return mode;
            }

            // detectionResults 배열에서 가장 자주 나타나는 클래스를 찾음
            const mostFrequentClass = findMode(detectionResults.flat());
            if (mostFrequentClass === null) {
                console.log("검출된 객체가 없습니다 다시 ㄱㄱ");
                // "검출된 객체가 없습니다" 메시지를 HTML에 출력
                document.getElementById("result").textContent = "검출된 객체가 없습니다 다시 ㄱㄱ";
            } else {
                console.log("가장 많이 출력된 클래스:", mostFrequentClass);

                
                // console.log("가장 많이 출력된 클래스:", mostFrequentClass);

                // "jpy_1000" -> 1000(숫자)로 변경
                const numericValue = parseInt(mostFrequentClass.replace("JPY_", ""), 10);
                if (!isNaN(numericValue)) {
                    console.log("숫자로 변환: " + numericValue * jpy_price);
                } else {
                    console.log("No valid numeric value found in the class.");
                }

                // html에 출력되는 값
                document.getElementById("result").textContent = "환률 계산 값: " + numericValue * jpy_price;
            }
            detectionResults = [];
        }, 3000); // 3초 (3000 밀리초)
    });


    let detectionResults = [];
    let detectFrameInterval;

    function startObjectDetection() {
        console.log("함수 시작");
        detectFrame()
    }

    function stopObjectDetection() {
        clearInterval(detectFrameInterval);   // detectframe 오류로 정지시킴
    }

});
