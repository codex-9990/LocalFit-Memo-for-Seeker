export type Point = readonly [number, number];
export type Pose = {
    head: Point; shoulder: Point; elbow: Point; hand: Point;
    hip: Point; knee: Point; ankle: Point;
    toe?: Point;
    elbowBack?: Point; handBack?: Point;
};
type Copy = readonly [japanese: string, english: string];
export type BodyweightGuide = {
    name: string;
    equipment: Copy;
    muscles: Copy;
    steps: readonly Copy[];
    cue: Copy;
    phases: readonly [Copy, Copy];
    scene: 'floor' | 'standing' | 'bar' | 'parallelBars' | 'wheel';
    hold?: boolean;
    poses: readonly [Pose, Pose];
};

// Canonical names deliberately identify a specific variation. A generic Squat
// or a user-defined exercise must not silently receive a bodyweight tutorial.
export const BODYWEIGHT_GUIDES: readonly BodyweightGuide[] = [
    {
        name: 'Push Up', scene: 'floor', equipment: ['床・マット', 'Floor or mat'],
        muscles: ['胸・腕・体幹', 'Chest, arms and core'],
        phases: [['腕を伸ばす', 'Arms extended'], ['体を下ろす', 'Lower your body']],
        steps: [
            ['手を肩幅より少し広くつき、脚を伸ばします。', 'Place your hands slightly wider than your shoulders and extend your legs.'],
            ['体を一直線に保ちながら肘を曲げ、胸を床に近づけます。', 'Bend your elbows and bring your chest toward the floor, keeping your body in a straight line.'],
            ['床を押して、ゆっくり開始姿勢へ戻ります。', 'Push through your hands to return steadily to the start.'],
        ],
        cue: ['お腹に力を入れ、腰だけが落ちないようにします。', 'Brace your core so your hips do not sag.'],
        poses: [
            { head: [253, 112], shoulder: [230, 124], elbow: [229, 155], hand: [228, 187], hip: [150, 149], knee: [107, 168], ankle: [65, 187] },
            { head: [254, 145], shoulder: [232, 157], elbow: [203, 170], hand: [228, 187], hip: [155, 171], knee: [110, 182], ankle: [65, 187] },
        ],
    },
    {
        name: 'Bodyweight Squat', scene: 'standing', equipment: ['器具なし', 'No equipment'],
        muscles: ['太もも・お尻', 'Thighs and glutes'],
        phases: [['立つ', 'Stand tall'], ['腰を下ろす', 'Lower your hips']],
        steps: [
            ['足を肩幅ほどに開き、つま先を少し外へ向けます。', 'Stand with feet about shoulder-width apart and toes turned slightly outward.'],
            ['かかとを床につけたまま、膝と股関節を曲げます。', 'Bend your knees and hips while keeping your heels on the floor.'],
            ['無理のない深さまで下ろし、床を押して立ちます。', 'Lower to a comfortable depth, then push through your feet to stand.'],
        ],
        cue: ['膝とつま先を同じ方向へ向けます。', 'Keep your knees moving in the same direction as your toes.'],
        poses: [
            { head: [153, 17], shoulder: [155, 42], elbow: [190, 55], hand: [225, 68], hip: [161, 90], knee: [160, 139], ankle: [161, 188] },
            { head: [184, 84], shoulder: [173, 109], elbow: [212, 105], hand: [251, 101], hip: [148, 154], knee: [196, 151], ankle: [161, 188] },
        ],
    },
    {
        name: 'Pull Up', scene: 'bar', equipment: ['懸垂バー', 'Pull-up bar'],
        muscles: ['背中・腕', 'Back and arms'],
        phases: [['ぶら下がる', 'Hang from the bar'], ['体を引き上げる', 'Pull yourself up']],
        steps: [
            ['バーを順手で握り、足を床から離します。', 'Grip the bar with palms facing away and lift your feet off the floor.'],
            ['体を振らずに肘を引き下げ、胸をバーへ近づけます。', 'Draw your elbows downward and bring your chest toward the bar without swinging.'],
            ['ゆっくり肘を伸ばして戻ります。', 'Lower yourself with control, extending your elbows.'],
        ],
        cue: ['勢いをつけず、コントロールできる範囲で動きます。', 'Use a range you can control without kicking or swinging.'],
        poses: [
            { head: [164, 77], shoulder: [164, 101], elbow: [177, 65], hand: [189, 28], elbowBack: [151, 65], handBack: [137, 28], hip: [160, 153], knee: [175, 178], ankle: [150, 196] },
            { head: [164, 17], shoulder: [164, 42], elbow: [202, 66], hand: [189, 28], elbowBack: [124, 68], handBack: [137, 28], hip: [160, 96], knee: [175, 125], ankle: [150, 150] },
        ],
    },
    {
        name: 'Dips', scene: 'parallelBars', equipment: ['平行棒', 'Parallel bars'],
        muscles: ['腕・胸', 'Arms and chest'],
        phases: [['体を支える', 'Support your body'], ['肘を曲げる', 'Bend your elbows']],
        steps: [
            ['平行棒を握り、腕で体を支えます。', 'Grip parallel bars and support your body with your arms.'],
            ['肘を曲げ、肩が無理なく動く範囲まで体を下ろします。', 'Bend your elbows and lower only as far as your shoulders comfortably allow.'],
            ['バーを押して開始姿勢へ戻ります。', 'Press through the bars to return to the start.'],
        ],
        cue: ['肩をすくめず、反動を使わずに動きます。', 'Keep your shoulders away from your ears and avoid bouncing.'],
        poses: [
            { head: [162, 18], shoulder: [162, 42], elbow: [164, 76], hand: [166, 110], elbowBack: [143, 74], handBack: [139, 105], hip: [153, 91], knee: [180, 128], ankle: [160, 164] },
            { head: [163, 58], shoulder: [163, 82], elbow: [194, 96], hand: [166, 110], elbowBack: [133, 83], handBack: [139, 105], hip: [155, 131], knee: [186, 155], ankle: [161, 185] },
        ],
    },
    {
        name: 'Crunch', scene: 'floor', equipment: ['床・マット', 'Floor or mat'],
        muscles: ['お腹', 'Abdominals'],
        phases: [['仰向けになる', 'Lie on your back'], ['肩を浮かせる', 'Lift your shoulders']],
        steps: [
            ['仰向けで膝を曲げ、足を床につけます。', 'Lie on your back with knees bent and feet on the floor.'],
            ['息を吐きながら、肩甲骨が床から離れる程度に上体を丸めます。', 'Exhale and curl up just enough to lift your shoulder blades off the floor.'],
            ['ゆっくり上体を下ろします。', 'Lower your upper body slowly.'],
        ],
        cue: ['手で首を引っ張らず、お腹を使って動きます。', 'Move with your abdominals without pulling on your neck.'],
        poses: [
            { head: [237, 161], shoulder: [214, 179], elbow: [192, 182], hand: [194, 159], hip: [155, 183], knee: [123, 129], ankle: [88, 186] },
            { head: [226, 130], shoulder: [207, 155], elbow: [181, 168], hand: [188, 146], hip: [155, 183], knee: [123, 129], ankle: [88, 186] },
        ],
    },
    {
        name: 'Plank', scene: 'floor', hold: true, equipment: ['床・マット', 'Floor or mat'],
        muscles: ['体幹', 'Core'],
        phases: [['姿勢を保つ', 'Hold this position'], ['姿勢を保つ', 'Hold this position']],
        steps: [
            ['肘を肩の下につき、前腕とつま先で体を支えます。', 'Place elbows under your shoulders and support yourself on forearms and toes.'],
            ['頭からかかとまでを一直線にし、その姿勢を保ちます。', 'Keep a straight line from your head to your heels and hold it.'],
            ['息を止めずに呼吸を続けます。', 'Keep breathing rather than holding your breath.'],
        ],
        cue: ['プランクは姿勢を保つ種目です。上下に動く必要はありません。', 'A plank is a static hold. You do not need to move up and down.'],
        poses: [
            { head: [247, 145], shoulder: [224, 156], elbow: [224, 188], hand: [257, 188], hip: [151, 171], knee: [108, 179], ankle: [64, 189] },
            { head: [247, 145], shoulder: [224, 156], elbow: [224, 188], hand: [257, 188], hip: [151, 171], knee: [108, 179], ankle: [64, 189] },
        ],
    },
    {
        name: 'Leg Raise', scene: 'floor', equipment: ['床・マット（仰向けで行う種目）', 'Floor or mat (lying variation)'],
        muscles: ['お腹・股関節まわり', 'Abdominals and hip flexors'],
        phases: [['脚を下ろす', 'Lower your legs'], ['脚を上げる', 'Raise your legs']],
        steps: [
            ['仰向けで脚を伸ばし、手を体の横に置きます。', 'Lie on your back with legs extended and hands beside your body.'],
            ['腰が反らないようにお腹に力を入れ、脚を上げます。', 'Brace your core and raise your legs without arching your lower back.'],
            ['腰を保てる範囲まで、ゆっくり脚を下ろします。', 'Lower slowly, only as far as you can keep your lower back controlled.'],
        ],
        cue: ['床すれすれまで下ろす必要はありません。', 'Your legs do not have to lower all the way to the floor.'],
        poses: [
            { head: [264, 167], shoulder: [243, 184], elbow: [219, 191], hand: [192, 191], hip: [188, 184], knee: [132, 177], ankle: [76, 170] },
            { head: [264, 167], shoulder: [243, 184], elbow: [219, 191], hand: [192, 191], hip: [188, 184], knee: [177, 129], ankle: [165, 74] },
        ],
    },
    {
        name: 'Ab Wheel', scene: 'wheel', equipment: ['腹筋ローラー・膝の下のマット', 'Ab wheel and a mat under your knees'],
        muscles: ['体幹', 'Core'],
        phases: [['膝をついて構える', 'Kneel and brace'], ['前へ転がす', 'Roll forward']],
        steps: [
            ['膝をつき、ローラーの持ち手を握ります。', 'Kneel and grip the handles of the wheel.'],
            ['お腹に力を入れ、腰を反らさずに少しずつ前へ転がします。', 'Brace your core and roll forward gradually without arching your lower back.'],
            ['姿勢を保てる距離で止め、ゆっくり引き戻します。', 'Stop within a range you can control and pull back slowly.'],
        ],
        cue: ['最初は短い距離で動きを確認します。', 'Start with a short range of movement.'],
        poses: [
            { head: [167, 70], shoulder: [145, 89], elbow: [166, 135], hand: [187, 181], hip: [113, 137], knee: [100, 184], ankle: [56, 187] },
            { head: [227, 116], shoulder: [205, 135], elbow: [244, 159], hand: [283, 183], hip: [147, 169], knee: [100, 184], ankle: [56, 187] },
        ],
    },
];

export const getBodyweightGuide = (name: string) => BODYWEIGHT_GUIDES.find(guide => guide.name === name);
