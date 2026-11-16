#!/bin/bash
# Video 1: ফার্মে একটা ঠান্ডা দিন (faceless cuts only)
set -e
C=$1; S=$2; OUT=$3
seg() { # idx file start dur
  echo "[$1:v]trim=start=$3:duration=$4,setpts=PTS-STARTPTS,scale=-2:1920,crop=1080:1920,setsar=1,fps=30[v$1];[$1:a]atrim=start=$3:duration=$4,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.12,afade=t=out:st=$(echo "$4-0.12"|bc):d=0.12[a$1];"
}
F="$(seg 0 x 2.0 3.5)$(seg 1 x 4.0 3.0)$(seg 2 x 2.0 5.0)$(seg 3 x 24.0 5.0)$(seg 4 x 3.0 5.0)"
F="${F}[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[vc];[a0][a1][a2][a3][a4]concat=n=5:v=0:a=1[a];"
F="${F}[vc][5:v]overlay=enable='between(t,0.2,3.5)'[o1];[o1][6:v]overlay=enable='between(t,3.7,6.5)'[o2];[o2][7:v]overlay=enable='between(t,6.7,11.5)'[o3];[o3][8:v]overlay=enable='between(t,11.7,16.5)'[o4];[o4][9:v]overlay=enable='between(t,16.7,21.3)'[v]"
ffmpeg -v error -y -i $C/IMG_1376.MOV -i $C/IMG_1392.MOV -i $C/IMG_1402.MOV -i $C/IMG_1402.MOV -i $C/IMG_1404.MOV -i $S/cap1.png -i $S/cap2.png -i $S/cap3.png -i $S/cap4.png -i $S/cap5.png -filter_complex "$F" -map "[v]" -map "[a]" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart $OUT
