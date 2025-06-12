import { FC } from "react";
import Player from "lottie-react";

// Downloaded from https://lottie.host/b1934a4c-53ff-4102-800a-09b68f679517/4Q4w0c4Dk0.json
import doneAnimation from "../../assets/lottie/done-checkmark.json";

const LottieDoneIcon: FC<{ className?: string }> = ({ className = "w-7 h-7" }) => (
  <div className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: 'transparent' }}>
    <Player
      autoplay={true}
      loop={false}
      animationData={doneAnimation}
      style={{ width: "100%", height: "100%", filter: 'none' }}
    />
  </div>
);

export default LottieDoneIcon;
