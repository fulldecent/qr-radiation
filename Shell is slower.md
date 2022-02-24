You do not want to do this in a shell script. It's way to slow.

# Custom QR code

**You can mix character encodings**

```sh
# YES IT WILL MIX CODES
qrcode --qversion 2 --error L --mask 1 --small '#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
```

## Analysis

Make target image // target.png

* Grayscale // yes, really grayscale (clip to mostly black/white) // make dontcares as 50% gray
* Same size as output image (41x41 pixels)

The largest version 6 code with ALPHA + NUMERIC

```sh
qrcode --qversion 6 --error L --mask 1 --scale 1 --qzone 0 'https://phor.net/#00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' --output out.png
```

How big?

```sh
file out.png
out.png: PNG image data, 41 x 41, 8-bit/color RGBA, non-interlaced
```

Score it

```sh
convert out.png target.png -compose Difference -composite -colorspace gray -format '%[mean]' info:  

15704.3
```

## Will approach

Score it

```sh
# $0 extra
function score() {
  qrcode --qversion 6 --error L --mask 1 --scale 1 --qzone 0 "https://phor.net/#$1" --output test.png 2>&1 > /dev/null
  # magick composite out.png -colorspace gray target.png -colorspace gray -compose Difference diff.png
  # convert out.png target.png -compose Difference -composite -colorspace gray -format '%[mean]' info:
  #compare -metric mse out.png target.png null: 2>&1 | cut -d' ' -f1
  #compare -metric fuzz out.png target.png null: 2>&1 | cut -d' ' -f1
  # compare -metric mse out.png target.png diff.png 2>&1 | cut -d' ' -f1
  #compare -metric psnr out.png target.png diff.png 2>&1 ### MAXIMIZE!
  # compare -metric ae -fuzz 80% test.png target.png diff.png 2>&1 
  compare -metric ae -fuzz 55% test.png target.png diff.png 2>&1 
  # compare -metric mse -fuzz 55% out.png target.png diff.png 2>&1 | cut -d' ' -f1
}

# STDIN extra
function mangle() {
  LOCATION=$[$(od -A n -t u -N 4 /dev/urandom) % 276]
  DIGIT=$[$(od -A n -t u -N 4 /dev/urandom) % 10]
  perl -pe "s/^(.{$LOCATION}).(.*)/\${1}$DIGIT\${2}/"
}

function mangle2() {
  LOCATION=$[$(od -A n -t u -N 4 /dev/urandom) % 275]
  DIGIT=$[$(od -A n -t u -N 4 /dev/urandom) % 10]
  DIGIT2=$[$(od -A n -t u -N 4 /dev/urandom) % 10]
  perl -pe "s/^(.{$LOCATION})..(.*)/\${1}$DIGIT$DIGIT2\${2}/"
}

function mangle3() {
  LOCATION=$[$(od -A n -t u -N 4 /dev/urandom) % 275]
  DIGIT=$[$(od -A n -t u -N 4 /dev/urandom) % 10]
  DIGIT2=$[$(od -A n -t u -N 4 /dev/urandom) % 10]
  DIGIT3=$[$(od -A n -t u -N 4 /dev/urandom) % 10]
  perl -pe "s/^(.{$LOCATION})...(.*)/\${1}$DIGIT$DIGIT2$DIGIT3\${2}/"
}

EXTRA="00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
EXTRA="67722321140421682650020792760717965472810559214461059343714733110462086714954019948408858034650807985965790836516382119978783334320704050547728456950796477623049173792976579272061689086576072427205286625810663115314400044447607109407645092756101443899420409327918590911639324"

SCORE=$(score $EXTRA)
# Change some digits
while true; do
  echo BEST $SCORE $EXTRA
  NEWEXTRA=$(echo $EXTRA | mangle | mangle2 | mangle3 | mangle | mangle2 | mangle3)
  NEWSCORE=$(score $NEWEXTRA)
  if [[ $NEWSCORE -lt $SCORE ]]
  then
    EXTRA=$NEWEXTRA
    SCORE=$NEWSCORE
    cp test.png out.png
  else
    echo "❌       $NEWEXTRA"
  fi
done
```
