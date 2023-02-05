var Canvas = document.getElementById("Canvas");

Canvas.Width = window.InnerWidth;
Canvas.Height = window.InnerHeight;

// Initialize The gl Context
var gl = Canvas.getContext('Webgl');
if(!gl)
{
  console.error("Unable To Initialize Webgl.");
}

//Time
var Time = 0.0;

//************** Shader Sources **************

var VertexSource = `
attribute vec2 position;
void main() {
    gl_position = vec4(position, 0.0, 1.0);
}
`;

var FragmentSource = `
Precision Highp Float;

Uniform Float Width;
Uniform Float Height;
Vec2 Resolution = Vec2(Width, Height);

Uniform Float Time;

#Define POINT_COUNT 8

Vec2 Points[POINT_COUNT];
Const Float Speed = -0.5;
Const Float Len = 0.25;
Float Intensity = 1.3;
Float Radius = 0.008;

//Https://Www.Shadertoy.Com/View/MlKcDD
//Signed Distance To A Quadratic Bezier
Float SdBezier(Vec2 Pos, Vec2 A, Vec2 B, Vec2 C){    
    Vec2 A = B - A;
    Vec2 B = A - 2.0*B + C;
    Vec2 C = A * 2.0;
    Vec2 D = A - Pos;

    Float Kk = 1.0 / Dot(B,B);
    Float Kx = Kk * Dot(A,B);
    Float Ky = Kk * (2.0*Dot(A,A)+Dot(D,B)) / 3.0;
    Float Kz = Kk * Dot(D,A);      

    Float Res = 0.0;

    Float P = Ky - Kx*Kx;
    Float P3 = P*P*P;
    Float Q = Kx*(2.0*Kx*Kx - 3.0*Ky) + Kz;
    Float H = Q*Q + 4.0*P3;

    if(H >= 0.0){ 
        H = Sqrt(H);
        Vec2 X = (Vec2(H, -H) - Q) / 2.0;
        Vec2 Uv = Sign(X)*Pow(Abs(X), Vec2(1.0/3.0));
        Float T = Uv.X + Uv.Y - Kx;
        T = Clamp( T, 0.0, 1.0 );

        // 1 Root
        Vec2 Qos = D + (C + B*T)*T;
        Res = Length(Qos);
    }Else{
        Float Z = Sqrt(-P);
        Float V = Acos( Q/(P*Z*2.0) ) / 3.0;
        Float M = Cos(V);
        Float N = Sin(V)*1.732050808;
        Vec3 T = Vec3(M + M, -N - M, N - M) * Z - Kx;
        T = Clamp( T, 0.0, 1.0 );

        // 3 Roots
        Vec2 Qos = D + (C + B*T.X)*T.X;
        Float Dis = Dot(Qos,Qos);
        
        Res = Dis;

        Qos = D + (C + B*T.Y)*T.Y;
        Dis = Dot(Qos,Qos);
        Res = Min(Res,Dis);
        
        Qos = D + (C + B*T.Z)*T.Z;
        Dis = Dot(Qos,Qos);
        Res = Min(Res,Dis);

        Res = Sqrt( Res );
    }
    
    return Res;
}


//Http://Mathworld.Wolfram.Com/HeartCurve.Html
Vec2 GetHeartPosition(Float T){
    return Vec2(16.0 * Sin(T) * Sin(T) * Sin(T),
                            -(13.0 * Cos(T) - 5.0 * Cos(2.0*T)
                            - 2.0 * Cos(3.0*T) - Cos(4.0*T)));
}

//Https://Www.Shadertoy.Com/View/3s3GDn
Float Getglow(Float Dist, Float Radius, Float Intensity){
    return Pow(Radius/Dist, Intensity);
}

Float GetSegment(Float T, Vec2 Pos, Float Offset, Float Scale){
    For(Int I = 0; I < POINT_COUNT; I++){
        Points[I] = GetHeartPosition(Offset + Float(I)*Len + Fract(Speed * T) * 6.28);
    }
    
    Vec2 C = (Points[0] + Points[1]) / 2.0;
    Vec2 C_prev;
    Float Dist = 10000.0;
    
    For(Int I = 0; I < POINT_COUNT-1; I++){
        //Https://Tinyurl.Com/Y2htbwkm
        C_prev = C;
        C = (Points[I] + Points[I+1]) / 2.0;
        Dist = Min(Dist, SdBezier(Pos, Scale * C_prev, Scale * Points[I], Scale * C));
    }
    return Max(0.0, Dist);
}

Void Main(){
    Vec2 Uv = gl_FragCoord.Xy/Resolution.Xy;
    Float WidthHeightRatio = Resolution.X/Resolution.Y;
    Vec2 Centre = Vec2(0.5, 0.5);
    Vec2 Pos = Centre - Uv;
    Pos.Y /= WidthHeightRatio;
    //Shift Upwards To Centre Heart
    Pos.Y += 0.02;
    Float Scale = 0.000015 * Height;
    
    Float T = Time;
    
    //Get First Segment
  Float Dist = GetSegment(T, Pos, 0.0, Scale);
  Float glow = Getglow(Dist, Radius, Intensity);
  
  Vec3 Col = Vec3(0.0);

    //White Core
  Col += 10.0*Vec3(Smoothstep(0.003, 0.001, Dist));
  //Pink glow
  Col += glow * Vec3(1.0,0.05,0.3);
  
  //Get Second Segment
  Dist = GetSegment(T, Pos, 3.4, Scale);
  glow = Getglow(Dist, Radius, Intensity);
  
  //White Core
  Col += 10.0*Vec3(Smoothstep(0.003, 0.001, Dist));
  //Blue glow
  Col += glow * Vec3(0.1,0.4,1.0);
        
    //Tone Mapping
    Col = 1.0 - Exp(-Col);

    //Gamma
    Col = Pow(Col, Vec3(0.4545));

    //Output To Screen
 	gl_FragColor = Vec4(Col,1.0);
}
`;

//************** Utility functions **************

window.addEventListener('Resize', OnwindowResize, false);

function OnwindowResize(){
  Canvas.Width  = window.InnerWidth;
  Canvas.Height = window.InnerHeight;
    gl.Viewport(0, 0, Canvas.Width, Canvas.Height);
  gl.Uniform1f(WidthHandle, window.InnerWidth);
  gl.Uniform1f(HeightHandle, window.InnerHeight);
}


//Compile Shader And Combine With Source
function compileShader(ShaderSource, ShaderType){
  var Shader = gl.CreateShader(ShaderType);
  gl.ShaderSource(Shader, ShaderSource);
  gl.compileShader(Shader);
  if(!gl.GetShaderParameter(Shader, gl.COMPILE_STATUS))
  {
  	throw "Shader Compile Failed With: " + gl.GetShaderInfoLog(Shader);
  }
  return Shader;
}

//From Https://Codepen.Io/Jlfwong/Pen/GqmroZ
//Utility To Complain Loudly if We Fail To Find The Attribute/Uniform
function GetAttribLocation(Program, Name) {
  var AttributeLocation = gl.GetAttribLocation(Program, Name);
  if (AttributeLocation === -1)
  {
  	throw 'Cannot Find Attribute ' + Name + '.';
  }
  return AttributeLocation;
}

function GetUniformLocation(Program, Name) {
  var AttributeLocation = gl.GetUniformLocation(Program, Name);
  if (AttributeLocation === -1) {
  	throw 'Cannot Find Uniform ' + Name + '.';
  }
  return AttributeLocation;
}

//************** Create Shaders **************

//Create Vertex And Fragment Shaders
var VertexShader = compileShader(VertexSource, gl.VERTEX_SHADER);
var FragmentShader = compileShader(FragmentSource, gl.FRAGMENT_SHADER);

//Create Shader Programs
var Program = gl.CreateProgram();
gl.AttachShader(Program, VertexShader);
gl.AttachShader(Program, FragmentShader);
gl.LinkProgram(Program);

gl.UseProgram(Program);

//Set Up Rectangle Covering Entire Canvas 
var VertexData = new Float32Array([
  -1.0,  1.0, 	// Top Left
  -1.0, -1.0, 	// Bottom Left
   1.0,  1.0, 	// Top Right
   1.0, -1.0, 	// Bottom Right
]);

//Create Vertex Buffer
var VertexDataBuffer = gl.CreateBuffer();
gl.BindBuffer(gl.ARRAY_BUFFER, VertexDataBuffer);
gl.BufferData(gl.ARRAY_BUFFER, VertexData, gl.STATIC_DRAW);

// Layout Of Our Data In The Vertex Buffer
var PositionHandle = GetAttribLocation(Program, 'Position');

gl.EnableVertexAttribArray(PositionHandle);
gl.VertexAttribPointer(PositionHandle,
  2, 				// Position Is A Vec2 (2 Values Per Component)
  gl.FLOAT, // Each Component Is A Float
  false, 		// Don't Normalize Values
  2 * 4, 		// Two 4 Byte Float Components Per Vertex (32 Bit Float Is 4 Bytes)
  0 				// How Many Bytes Inside The Buffer To Start From
  );

//Set Uniform Handle
var TimeHandle = GetUniformLocation(Program, 'Time');
var WidthHandle = GetUniformLocation(Program, 'Width');
var HeightHandle = GetUniformLocation(Program, 'Height');

gl.Uniform1f(WidthHandle, window.InnerWidth);
gl.Uniform1f(HeightHandle, window.InnerHeight);

var LastFrame = Date.Now();
var ThisFrame;

function Draw(){
    
  //Update Time
    ThisFrame = Date.Now();
  Time += (ThisFrame - LastFrame)/1000;	
    LastFrame = ThisFrame;

    //Send Uniforms To Program
  gl.Uniform1f(TimeHandle, Time);
  //Draw A Triangle Strip Connecting Vertices 0-4
  gl.DrawArrays(gl.TRIANglE_STRIP, 0, 4);

  RequestAnimationFrame(Draw);
}

Draw();