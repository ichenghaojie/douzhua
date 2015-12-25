/*global $, express, require(), _, AV, FastClick, wx, campaignTools, Swiper, performance, JSONEditor */



$(function () {
    $('#form').submit(function (e) {
        e.preventDefault();
        var url = encodeURI($.trim($('#input-url').val()));
       
        var target = $('.radio-block input[type="radio"]:checked').val();
        
        // if (!url || url === 'http://') {
        //     //- 弹出提示
        //     return;
        // }

        $('#spider-return').show();
        $('#spider-cont').html('<div id="loading" style="text-align: center"><img src="/img/icon/crawl.gif"><p>正在抓...</p></div>').show();
        $('#loading').show();

        //$('#jsoneditor').empty();
        $('#albumPage').hide();
        $('#moviePage').hide();
        $('.rating_nums').empty();
        $('.movieInfo').empty();
        $('.moviePic').empty();
        
        $('.steps, h4').hide();
        $('#download').attr('href', '');
        $('#retry').remove();

        $.ajax({
            url: '/parse',
            method: 'POST',
            data: {url: url, target: target},
            success: function (res) {
                
                // $('#spider-cont').html(res.message);

                if (res.err) {
                    $('#loading').hide().after('<p id="retry">抓取时出了问题，重新试下。错误信息：' + res.message + '</p>');
                    return;
                }

                var container = document.getElementById('jsoneditor');

                // var options = {
                //     mode: 'code',
                //     modes: ['code', 'form', 'text', 'tree', 'view'], // allowed modes
                //     error: function (err) {
                //         alert(err.toString());
                //     }
                // };

                var json = res.message;

                $('#download').attr('href', res.downloadUrl);

                $('#spider-cont').hide();
                $('#loading').hide();
                $('#spider-source, #spider-return h4, .steps ').show();
                if(target==2){
                    $('.rating_nums').html(res.score);
                    $('.movieInfo').html('<h2>'+res.infoTitle+'</h2>'+'<p>'+res.infoCont+'</p>');
                    $('.moviePic').html('<h2>'+res.picTitle+'</h2>' + '<ul>'+res.picCont+'</ul>');
                
                    var mImg = $('.moviePic').find('img');
                    for(var i = 0;i < mImg.length; i++){
                        mImg[i].src ='../img/download' + res.picPath + (i+1) + '.jpg' ;
                    }
                    $('#moviePage').show();
                }else if(target==1){

                    $('#albumPage').find('h2').html('<a  href="'+url+'">'+ res.message+'</a>');
                    $('#albumPage').show();
                }
                
            }
        });
    });

    $('.radio-block').click(function () {
        $(this).find('input[type="radio"]').prop('checked', true);
        //- radio.attr('checked', 'checked');
        var value = $(this).find('input[type="radio"]:checked').val();

        if (value === '1') {
            $('#input-url').attr('placeholder', '输入要打包的相册');
        } else if (value === '2') {
            $('#input-url').attr('placeholder', '输入要抓取的电影');
        }
    });
});





