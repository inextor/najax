/*
		var httpRequestWrapper = require('nodeHttpRequestWrapper');

	httpRequestWrapper
	({
		url				: 'https://google.com'
		,debug			: false
		,post			: {'Hello' : 'World' } // OR null
		,headers		: {'Accept-Language'	: 'en-US'}
		,proxy			: 'http://myproxy.com'
		,proxyPort		: 8080
		,maxRedirects	: 10
		,timeout		: 3000
		,success		: function( data,headers,cookiejar ) //set if you spect string data
		{

		}
		,error	: function( xxx )
		{
			//
		}
		,onData		: function( chunk ) //Set if you spect binary data
		{

		}
		,onEnd		: function() //Set if you spect binary data
		{

		}
	});
*/
 //var HttpsProxyAgent = require('https-proxy-agent');
 //var HttpProxyAgent = require('http-proxy-agent');

const qs				= require('qs');
var tough			= require('tough-cookie');
var Cookie			= tough.Cookie;
var zlib			= require('zlib');

function httpRequest( obj )
{
	var cookiejar		= obj.cookiejar || new tough.CookieJar();

	var colors			= null;

	if( obj.debug )
		colors			= require('colors/safe');

	const url			= require('url');

	var urlObj			= url.parse( obj.url );


	var http			=  urlObj.protocol === 'http:' ? require('http') : require('https');
	var method			= 'GET';
	var postData		= '';
	var headers	 		= {};
	var charset			= null;

	if( obj.debug )
	{
		console.log
		(
			colors.green('Connecting to')
			,colors.white.bold( obj.url )
		);
	}

	for(var i in obj.headers )
	{
		headers[ i ]	= obj.headers[ i ];

		if( i.toLowerCase() == 'cookie' )
		{
			//console.log(colors.yellow.bold('Cookies'),colors.green.bold( obj.headers[ i ] ) );
			cookiejar.setCookieSync( obj.headers[ i ], obj.url,{loose: true});
		}

		if( i.toLowerCase() == 'Connection' )
		{

		}
	}

	var cookieString	= cookiejar.getCookieStringSync( obj.url,{} );

	if( cookieString )
	{
		//console.log(colors.yellow.bold('Setting The Cookie'),colors.green.bold( cookieString ) );
		headers.Cookie	= cookieString;
	}

	if( obj.post  || obj.data )
	{
		method						= 'POST';
	   	postData					= qs.stringify( obj.post || obj.data );

		if( obj.debug )
			console.log( colors.magenta( 'post_data') , postData );

		headers['Content-Type']		= 'application/x-www-form-urlencoded';
		headers['Content-Length']	= postData.length;
	}


	if( obj.debug )
	{
		for(var j in headers )
		{
			console.log( colors.magenta( j +' :') ,colors.cyan( headers[ j ] ) );
		}
	}

	var port		=  urlObj.port;

	if( ! port )
	{

   		port	= urlObj.protocol === 'https:' ? 443 : 80;

		if( obj.debug )
			console.log('Overriding Port because protocol'+colors.yellow.bold( port ));
	}

	if( obj.debug )
		console.log(colors.blue( 'Port: '),colors.green( port) );

	var agent	= null;

	if( obj.proxy )
	{

		var HttpProxyAgent		= null;
		var HttpsProxyAgent		= null;

		if( urlObj.protocol == 'http:' )
			HttpProxyAgent	= require('http-proxy-agent');
		else
			HttpsProxyAgent = require('https-proxy-agent');

		var proxyPort	= obj.proxyPort || 80;
		var proxyUrl	= '';

		if( urlObj.protocol === 'http:' )
		{
			proxyString	= 'http://'+obj.proxy+':'+proxyPort;
			agent 		= new HttpProxyAgent( proxyString );
		}
		else
		{
			proxyString	= 'https://'+obj.proxy+':'+proxyPort;
			agent		= new HttpsProxyAgent( proxyString );
		}

		if( obj.debug ) console.log( colors.yellow.bold('Using Proxy:'), proxyString );
	}

	var options		=
	{
		hostname		: urlObj.hostname
		,port			: port
		,path			: urlObj.path
		,method			: method
		,headers		: headers
		,protocol		: urlObj.protocol
		,agent			: agent
	};

	if( obj.debug )
	{
		console.log
		(
			colors.blue(  method )
			,' ',colors.red.bold( urlObj.protocol+'//' )+colors.green( urlObj.hostname )+colors.blue( urlObj.path)
		);
	}

	if( typeof obj.auth !== "undefined" && obj.auth.trim() !== '')
	{
		options.auth = obj.auth;
	}


	var req = http.request(options, (res) =>
	{
		if( obj.debug ) console.log( colors.blue('STATUS: '), colors.green( res.statusCode) );

		//for(var i=0;i<res.headers.length;i++)

		if( obj.debug ) console.log(colors.magenta.bold('Response Headers'));

		for(var i in res.headers )
		{
			if( obj.debug )
			{
				console.log
				(
					colors.cyan.bold(i+' :')
					,colors.green(res.headers[i])
				);
			}

			if( i === 'content-type' )
			{
				if(  res.headers[i].match( /charset=/ ) )
				{
					charset	= res.headers[ i ].replace(/.*charset=/,'');
					if( obj.debug ) console.log( colors.red('SET charset'),colors.green.bold( charset) );
				}
				else
				{
					if( obj.debug ) console.log( colors.red('SET utf-8 AS default CHARSET') );
				}

			}
			else if( i=== 'set-cookie')
			{

				if (res.headers['set-cookie'] instanceof Array)
					  cookies = res.headers['set-cookie'].map(Cookie.parse);
				else
					  cookies = [Cookie.parse(res.headers['set-cookie'])];

				for(var j=0;j<cookies.length;j++)
				{
					try
					{
						cookiejar.setCookieSync( cookies[j], obj.url ,{loose: true} );
					}catch( e)
					{
						if( this.debug )
							console.log( e );
					}
				}
			}
			else if( i === 'content-encoding' )
			{

			}
		}

		if( obj.onHeaders )
		{
			if( obj.debug )
				console.log('ON headers');

			obj.onHeaders( res.headers );
		}

		if( res.statusCode  >= 300 && res.statusCode < 400 )
		{
			if( !obj.maxRedirects )
			{
				//if( obj.debug ) console.log(colors.red( 'Max Redirects Reached' ));

				if( obj.error )
					obj.error('Max Redirects Reached');
				return;
			}

			req.abort();

			if( obj.debug )
			{
				console.log
				(
					colors.red.bold('Redirecting to: ')
					,colors.green.bold( res.headers.location )
				);
			}

			var newRequestObject 			= {};

			for(var k in obj)
			{
				newRequestObject[ k ]		= obj[k];
				obj[k]						= null;
			}

			newRequestObject.maxRedirects	= obj.maxRedirects - 1;
			if( res.headers.location.indexOf('//' ) === 0 )
			{
				res.headers.location = urlObj.protocol+res.headers.location;
			}
			newRequestObject.url			= res.headers.location;
			newRequestObject.cookiejar		= cookiejar;

			for(var l in obj.headers )
			{
				var ll = l.toLowerCase();
				if( ll.indexOf('accept-') === 0 || ll === 'user-agent' || ll === 'dnt' || ll === 'cache-control')
				{
					newRequestObject.headers[ l ] =  obj.headers;
				}
			}
			newRequestObject.referer		= obj.url;

			httpRequest( newRequestObject );
			return;
		}
		else if( res.statusCode > 400 )
		{
			if( obj.debug )
				console.error('Fail code is', res.statusCode );
		}




		var data		=	'';
		var chunks		= [];
		var totallength	= 0;

		res.on('data', (chunk) =>
		{
			if( obj.debug ) console.log(colors.yellow('CHUNK Arrived'),colors.magenta.bold( chunk.length ));

			 totallength += chunk.length;

			if( obj.onData )
			{
				obj.onData( chunk );
			}
			else
			{
				chunks.push( chunk );
			}
		});

		res.on('end', () =>
		{
			if( obj.debug ) console.log( colors.cyan.bold( 'Read Bytes'),colors.green.bold( totallength ));
			if( obj.debug ) console.log( colors.red( 'No more data in response.'));

			if( obj.success )
			{
				var results = new Buffer( totallength );
				var pos		= 0;

				for (var i = 0; i < chunks.length; i++)
				{
					chunks[ i ].copy( results, pos );
					pos += chunks[ i ].length;
				}

				var data	= null;

				var decodingCb	= function( buffer )
				{
					if(!charset )
					{
						if( obj.dataType == 'json' ||
							[
								'text/json'
								,'application/json'
								,'application/x-javascript'
								,'text/javascript'
								,'text/x-javascript'
								,'text/x-json'
							].indexOf( res.headers['content-type'] ) !== -1
						  )
						{
							charset = 'utf-8';
						}
					}

					if( charset || (typeof res.headers['content-type'] === "string" && res.headers['content-type'].indexOf('text') >= 0 ) )
					{
						if( !charset || obj.dataType == 'json' || ( charset && ( charset.toLowerCase().indexOf('utf-8') !== -1 ||  charset.toLowerCase().indexOf('utf8') !== -1 )  ) )
						{
							data			= buffer.toString('utf8');
						}
						else if( charset )
						{

							var Iconv		= require('iconv').Iconv;
							var iconv		= new Iconv( charset , 'utf-8');

							var converted	= iconv.convert( buffer );
							data			= converted.toString('utf-8');
						}

						if( obj.dataType === 'json' )
						{
							var objCb = null;
							try
							{
								objCb = JSON.parse( data );
							}
							catch(e)
							{
								if( typeof obj.error === "function")
								{
									if( obj.debug )
										console.log('Fails on json parse assing objCb');

									obj.error( e );

								}
								return;
							}

							obj.success( objCb, res.headers, cookiejar );
						}
						else
						{
							obj.success( data , res.headers, cookiejar );
						}
					}
					else
					{
						obj.success( buffer, res.headers, cookiejar );
					}

					if( obj.end )
						obj.end();
				};

				if( res.headers['content-encoding'] === 'gzip' || res.headers['content-encoding'] === 'deflate' )
				{
					if( obj.debug ) console.log( colors.red.bold('Using zlib'));

					zlib.unzip( results, function( err, buffer )
					{
						if( err )
						{
							if( obj.debug )
								console.log('Fails here');

							obj.error( err );
							obj.end();
							return;
						}
						decodingCb( buffer );
					});
				}
				else
				{
					decodingCb( results );
				}
			}
		});
	});

	if( obj.timeout )
	{
		req.on('socket', function (socket)
		{
			socket.setTimeout( obj.timeout );
			socket.on('timeout', function()
			{
				if( obj.debug )
					console.log('Timeout');

				req.abort();
			});
		});
	}

	req.on('error', (e) =>
	{
	 	if( obj.debug ) console.log(colors.blue('problem with request:'),colors.red( e.message ));
		if( obj.error ) obj.error(e);
	});

	if( obj.debug ) console.log(colors.blue('post data length is:'), colors.red( postData.length ) );

	// write data to request body
	if( method == 'POST' )
	{
		req.write(postData);
	}

	req.end();
}

module.exports = httpRequest;
