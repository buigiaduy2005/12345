import React, { useState, useEffect } from 'react';
import { Table, Tag, Card, Row, Col, Statistic, DatePicker, Select, Input, Space, Button, Typography, Tooltip, App } from 'antd';
import { 
    SecurityScanOutlined, 
    CameraOutlined, 
    WarningOutlined, 
    GlobalOutlined, 
    KeyOutlined, 
    ReloadOutlined,
    SearchOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { monitorService } from '../services/monitorService';
import type { MonitorLog, MonitorSummary } from '../services/monitorService';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const MonitorLogsPage: React.FC = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<MonitorLog[]>([]);
    const [summary, setSummary] = useState<MonitorSummary | null>(null);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);

    // Filters
    const [logType, setLogType] = useState<string | undefined>(undefined);
    const [minSeverity, setMinSeverity] = useState<number | undefined>(undefined);
    const [computerUser, setComputerUser] = useState<string>('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [logsRes, summaryRes] = await Promise.all([
                monitorService.getLogs({
                    page,
                    pageSize,
                    logType,
                    minSeverity,
                    computerUser: computerUser || undefined
                }),
                monitorService.getSummary()
            ]);
            setLogs(logsRes.data);
            setTotal(logsRes.totalCount);
            setSummary(summaryRes);
        } catch (error) {
            console.error('Failed to load monitor logs:', error);
            message.error(t('monitor.load_error', 'Không thể tải dữ liệu giám sát'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [page, logType, minSeverity]);

    const getSeverityColor = (score: number) => {
        if (score >= 9) return '#ff4d4f'; // Red
        if (score >= 7) return '#faad14'; // Orange
        if (score >= 5) return '#1890ff'; // Blue
        return '#52c41a'; // Green
    };

    const columns = [
        {
            title: t('monitor.timestamp', 'Thời gian'),
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 180,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm:ss'),
        },
        {
            title: t('monitor.type', 'Loại'),
            dataIndex: 'logType',
            key: 'logType',
            width: 150,
            render: (type: string) => {
                switch (type) {
                    case 'Screenshot':
                        return <Tag icon={<CameraOutlined />} color="cyan">{t('monitor.type_screenshot', 'Chụp màn hình')}</Tag>;
                    case 'KeywordDetected':
                        return <Tag icon={<KeyOutlined />} color="purple">{t('monitor.type_keyword', 'Từ khóa nhạy cảm')}</Tag>;
                    case 'NetworkDisconnect':
                        return <Tag icon={<GlobalOutlined />} color="error">{t('monitor.type_network', 'Mất kết nối')}</Tag>;
                    default:
                        return <Tag>{type}</Tag>;
                }
            }
        },
        {
            title: t('monitor.user', 'Nhân viên'),
            key: 'user',
            width: 150,
            render: (record: MonitorLog) => (
                <Space orientation="vertical" size={0}>
                    <Text strong>{record.computerUser}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>{record.computerName}</Text>
                </Space>
            )
        },
        {
            title: t('monitor.severity', 'Mức độ'),
            dataIndex: 'severityScore',
            key: 'severityScore',
            width: 100,
            render: (score: number) => (
                <Tag color={getSeverityColor(score)} style={{ fontWeight: 'bold' }}>
                    {score}/10
                </Tag>
            )
        },
        {
            title: t('monitor.content', 'Nội dung/Bối cảnh'),
            key: 'content',
            render: (record: MonitorLog) => (
                <Space orientation="vertical" size={2}>
                    {record.detectedKeyword && (
                        <Text strong type="danger">
                            <KeyOutlined /> {t('monitor.keyword', 'Từ khóa')}: {record.detectedKeyword}
                        </Text>
                    )}
                    <div style={{ maxWidth: '400px', whiteSpace: 'pre-wrap' }}>
                        {record.messageContext || record.message}
                    </div>
                    {(record.applicationName || record.windowTitle) && (
                        <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                            {record.applicationName} {record.windowTitle ? ` - ${record.windowTitle}` : ''}
                        </Text>
                    )}
                </Space>
            )
        },
        {
            title: t('monitor.assessment', 'Đánh giá rủi ro'),
            dataIndex: 'actionTaken',
            key: 'actionTaken',
            width: 250,
            render: (text: string) => <Text style={{ fontSize: '13px' }}>{text}</Text>
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={2} style={{ margin: 0 }}>
                    <SecurityScanOutlined /> {t('monitor.title', 'Giám sát Agent Máy tính Cá nhân')}
                </Title>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<SecurityScanOutlined />} 
                        style={{ backgroundColor: '#722ed1' }}
                        onClick={() => message.info('Tính năng điều khiển Agent đang được phát triển...')}
                    >
                        Agent kiểm soát tại máy tính cá nhân
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                        {t('common.refresh', 'Làm mới')}
                    </Button>
                </Space>
            </div>

            {/* Summary Stats */}
            <Row gutter={16} style={{ marginBottom: '24px' }}>
                <Col span={6}>
                    <Card variant="borderless" className="monitor-stat-card" style={{ background: '#f0f5ff' }}>
                        <Statistic
                            title={t('monitor.total_today', 'Tổng cảnh báo hôm nay')}
                            value={summary?.totalToday || 0}
                            styles={{ content: { color: '#1d39c4' } }}
                            prefix={<SecurityScanOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card variant="borderless" className="monitor-stat-card" style={{ background: '#fff1f0' }}>
                        <Statistic
                            title={t('monitor.critical_today', 'Nguy hiểm (>=7)')}
                            value={summary?.criticalToday || 0}
                            styles={{ content: { color: '#cf1322' } }}
                            prefix={<WarningOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card variant="borderless" className="monitor-stat-card" style={{ background: '#e6fffb' }}>
                        <Statistic
                            title={t('monitor.screenshots_today', 'Ảnh chụp màn hình')}
                            value={summary?.screenshotsToday || 0}
                            styles={{ content: { color: '#08979c' } }}
                            prefix={<CameraOutlined />}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card variant="borderless" className="monitor-stat-card" style={{ background: '#f9f0ff' }}>
                        <Statistic
                            title={t('monitor.keywords_today', 'Từ khóa nhạy cảm')}
                            value={summary?.keywordsToday || 0}
                            styles={{ content: { color: '#531dab' } }}
                            prefix={<KeyOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Filters */}
            <Card style={{ marginBottom: '16px' }} size="small">
                <Space size="large" wrap>
                    <div>
                        <Text type="secondary" style={{ marginRight: 8 }}>{t('monitor.filter_type', 'Loại sự kiện')}:</Text>
                        <Select 
                            placeholder={t('monitor.all', 'Tất cả')} 
                            style={{ width: 160 }} 
                            allowClear 
                            onChange={v => setLogType(v)}
                        >
                            <Option value="Screenshot">{t('monitor.type_screenshot', 'Chụp màn hình')}</Option>
                            <Option value="KeywordDetected">{t('monitor.type_keyword', 'Từ khóa nhạy cảm')}</Option>
                            <Option value="NetworkDisconnect">{t('monitor.type_network', 'Mất kết nối')}</Option>
                        </Select>
                    </div>

                    <div>
                        <Text type="secondary" style={{ marginRight: 8 }}>{t('monitor.filter_severity', 'Mức độ tối thiểu')}:</Text>
                        <Select 
                            placeholder={t('monitor.all', 'Tất cả')} 
                            style={{ width: 120 }} 
                            allowClear 
                            onChange={v => setMinSeverity(v)}
                        >
                            <Option value={1}>1+</Option>
                            <Option value={4}>4+</Option>
                            <Option value={7}>7+</Option>
                            <Option value={9}>9+</Option>
                        </Select>
                    </div>

                    <div>
                        <Text type="secondary" style={{ marginRight: 8 }}>{t('monitor.filter_user', 'Người dùng')}:</Text>
                        <Input 
                            placeholder={t('monitor.search_user', 'Tìm tên/máy...')} 
                            style={{ width: 180 }}
                            onPressEnter={e => {
                                setComputerUser((e.target as HTMLInputElement).value);
                                setPage(1);
                                loadData();
                            }}
                            suffix={<SearchOutlined onClick={loadData} style={{ cursor: 'pointer' }} />}
                        />
                    </div>
                </Space>
            </Card>

            {/* Table */}
            <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                loading={loading}
                pagination={{
                    current: page,
                    pageSize: pageSize,
                    total: total,
                    onChange: (p) => setPage(p),
                    showSizeChanger: false,
                    placement: 'bottomCenter' as any
                }}
                className="monitor-table"
            />
        </div>
    );
};

export default MonitorLogsPage;
