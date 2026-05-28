using UnityEngine;
using UnityEngine.UI;

public class MainPanel : MonoBehaviour
{
    [Header("Panel Settings")]
    public KeyCode hotKey = KeyCode.C;
    public GameObject panel;

    [Header("Toggle References")]
    public Toggle equipmentToggle;
    public Toggle attributeToggle;
    public Toggle skillTreeToggle;
    public Toggle classSkillToggle;
    public Toggle upgradeToggle;
    public Toggle craftToggle;
    public Toggle questToggle;
    public Toggle guildToggle;

    [Header("Panel References")]
    public GameObject equipmentPanel;
    public GameObject attributePanel;
    public GameObject skillTreePanel;
    public GameObject classSkillPanel;
    public GameObject upgradePanel;
    public GameObject craftPanel;
    public GameObject questPanel;
    public GameObject guildPanel;

    void Start()
    {
        SetupToggleListeners();
    }

    void SetupToggleListeners()
    {
        if (equipmentToggle) equipmentToggle.onValueChanged.AddListener((val) => OnToggleChanged(equipmentToggle, equipmentPanel, val));
        if (attributeToggle) attributeToggle.onValueChanged.AddListener((val) => OnToggleChanged(attributeToggle, attributePanel, val));
        if (skillTreeToggle) skillTreeToggle.onValueChanged.AddListener((val) => OnToggleChanged(skillTreeToggle, skillTreePanel, val));
        if (classSkillToggle) classSkillToggle.onValueChanged.AddListener((val) => OnToggleChanged(classSkillToggle, classSkillPanel, val));
        if (upgradeToggle) upgradeToggle.onValueChanged.AddListener((val) => OnToggleChanged(upgradeToggle, upgradePanel, val));
        if (craftToggle) craftToggle.onValueChanged.AddListener((val) => OnToggleChanged(craftToggle, craftPanel, val));
        if (questToggle) questToggle.onValueChanged.AddListener((val) => OnToggleChanged(questToggle, questPanel, val));
        if (guildToggle) guildToggle.onValueChanged.AddListener((val) => OnToggleChanged(guildToggle, guildPanel, val));
    }

    void Update()
    {
        Player player = Player.localPlayer;
        if (player)
        {
            if (Input.GetKeyDown(hotKey) && !UIUtils.AnyInputActive())
                panel.SetActive(!panel.activeSelf);
        }
    }

    void OnToggleChanged(Toggle toggle, GameObject panelToShow, bool isOn)
    {
        if (isOn)
        {
            HideAllPanels();
            if (panelToShow) panelToShow.SetActive(true);
        }
    }

    void HideAllPanels()
    {
        if (equipmentPanel) equipmentPanel.SetActive(false);
        if (attributePanel) attributePanel.SetActive(false);
        if (skillTreePanel) skillTreePanel.SetActive(false);
        if (classSkillPanel) classSkillPanel.SetActive(false);
        if (upgradePanel) upgradePanel.SetActive(false);
        if (craftPanel) craftPanel.SetActive(false);
        if (questPanel) questPanel.SetActive(false);
        if (guildPanel) guildPanel.SetActive(false);
    }
}
